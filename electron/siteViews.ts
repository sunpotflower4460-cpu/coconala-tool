/**
 * メルカリ・ヤフオク・ラクマ・Amazon の実際の検索ページを、アプリ画面の右側のタブに表示する。
 *
 * 方針（規約への配慮）:
 *  - ふつうのブラウザと同じく、利用者に見える形でページを表示するだけ。1回の検索で各サイト1ページだけ読み込む。
 *  - ページ送り・裏での巡回・再試行の自動化はしない。ログイン・画像認証が出たら利用者に任せる（突破しない）。
 *  - 値段の取り込みは利用者が「取り込む」を押したときだけ（`capture.ts`）。
 *  - User-Agent は内蔵 Chromium の標準表記から「Electron」等のアプリ名を外すだけ（偽装はしない）。
 */
import { BrowserWindow, WebContentsView, session, shell, type Session } from 'electron';
import type { SiteBounds, SiteLayout, SiteMarket, SiteState } from '../src/lib/desktopBridge';
import { SITE_MARKETS } from '../src/lib/desktopBridge';
import { buildSearchLinks } from '../src/services/searchLinkBuilder';
import { isLoopbackUrl } from '../functions/api/shared';

const SHORTCUT_ID: Record<SiteMarket, string> = {
  mercari: 'mercari',
  yahoo_auctions: 'yahoo-auctions',
  rakuma: 'rakuma',
  amazon: 'amazon',
};

/** 各タブで開いてよいサイト（これ以外へのリンクは既定のブラウザで開く） */
const ALLOWED_HOSTS: Record<SiteMarket, RegExp> = {
  mercari: /(^|\.)mercari\.com$/,
  yahoo_auctions: /(^|\.)yahoo\.co\.jp$/,
  rakuma: /(^|\.)fril\.jp$|(^|\.)rakuten\.co\.jp$/,
  amazon: /(^|\.)amazon\.co\.jp$/,
};

/** 自動テスト用: 偽サーバーの架空ページへ向ける（フラグ＋ループバック限定。本番では効かない） */
function testSiteBase(): string | null {
  const base = process.env.E2E_SITE_BASE;
  if (process.env.E2E_FAKE_UPSTREAM === '1' && base && isLoopbackUrl(base)) return base.replace(/\/$/, '');
  return null;
}

export function siteSearchUrl(market: SiteMarket, query: string): string {
  const base = testSiteBase();
  if (base) return `${base}/${market}?q=${encodeURIComponent(query)}`;
  const link = buildSearchLinks(query).find((l) => l.id === SHORTCUT_ID[market]);
  if (!link) throw new Error(`no search link for ${market}`);
  return link.url;
}

/** いま表示しているのが、そのサイトの検索結果のページか（最後に「まとめて探す」で開いた形のページか） */
export function isSearchPage(market: SiteMarket, url: string): boolean {
  try {
    const current = new URL(url);
    const expected = new URL(siteSearchUrl(market, 'q'));
    return current.origin === expected.origin && current.pathname === expected.pathname;
  } catch {
    return false;
  }
}

/** 外部ページの広告等が既定のブラウザを勝手に何度も開かないよう、https だけ・1秒に1回までにする */
const lastExternalOpen = new Map<SiteMarket, number>();
function openExternalFromSite(market: SiteMarket, url: string): void {
  if (!/^https:\/\//.test(url)) return;
  const now = Date.now();
  if (now - (lastExternalOpen.get(market) ?? 0) < 1000) return;
  lastExternalOpen.set(market, now);
  void shell.openExternal(url);
}

function isAllowed(market: SiteMarket, url: string): boolean {
  try {
    const parsed = new URL(url);
    if (testSiteBase() && parsed.origin === new URL(testSiteBase() as string).origin) return true;
    return parsed.protocol === 'https:' && ALLOWED_HOSTS[market].test(parsed.hostname);
  } catch {
    return false;
  }
}

export function sitesSession(): Session {
  const ses = session.fromPartition('persist:sites');
  const ua = ses.getUserAgent().replace(/\s+Electron\/\S+/, '').replace(/\s+[\w-]+\/\d+\.\d+\.\d+(?:-[\w.]+)?(?=\s+Chrome\/)/, '');
  ses.setUserAgent(ua);
  // カメラ・位置情報などの許可は求めさせない
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  return ses;
}

export class SiteViews {
  private views = new Map<SiteMarket, WebContentsView>();
  /** 最後の「まとめて探す」で開いた検索ページが、表示に切り替わったか（切り替わる前は前の検索のページのまま） */
  private committed = new Map<SiteMarket, boolean>();
  private states = new Map<SiteMarket, SiteState>();
  private layout: SiteLayout = { visible: false, active: null, bounds: null };
  private readonly ses: Session;

  constructor(
    private readonly win: BrowserWindow,
    private readonly onStates: (states: SiteState[]) => void,
  ) {
    this.ses = sitesSession();
    for (const market of SITE_MARKETS) this.states.set(market, { market, status: 'idle' });
  }

  resendStates(): void {
    this.emit();
  }

  private emit(): void {
    this.onStates(SITE_MARKETS.map((m) => this.states.get(m) as SiteState));
  }

  private update(market: SiteMarket, patch: Partial<SiteState>): void {
    this.states.set(market, { ...(this.states.get(market) as SiteState), ...patch });
    this.emit();
  }

  private ensureView(market: SiteMarket): WebContentsView {
    const existing = this.views.get(market);
    if (existing) return existing;
    const view = new WebContentsView({
      // 裏のタブでも検索結果が描かれるよう、描画の間引きを止める（取り込みは表示中の内容を読むため）
      webPreferences: { session: this.ses, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, backgroundThrottling: false },
    });
    view.setBackgroundColor('#ffffff');
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      // 新しいウィンドウで開こうとしたリンク: 同じサイトならこのタブで、それ以外は既定のブラウザで開く
      if (isAllowed(market, url)) void wc.loadURL(url);
      else openExternalFromSite(market, url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (event, url) => {
      if (!isAllowed(market, url)) {
        event.preventDefault();
        openExternalFromSite(market, url);
      }
    });
    // サーバー側の転送で、許可していないサイトへ移らないようにする
    wc.on('will-redirect', (event, url) => {
      if (!isAllowed(market, url)) event.preventDefault();
    });
    wc.on('did-start-loading', () => this.update(market, { status: 'loading' }));
    wc.on('did-navigate', () => this.committed.set(market, true));
    wc.on('did-stop-loading', () =>
      this.update(market, { status: 'ready', url: wc.getURL(), title: wc.getTitle(), canGoBack: wc.navigationHistory.canGoBack() }),
    );
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) this.update(market, { status: 'failed', url: wc.getURL() });
    });
    view.setVisible(false);
    view.setBounds(this.lastBounds);
    this.win.contentView.addChildView(view);
    this.views.set(market, view);
    return view;
  }

  view(market: SiteMarket): WebContentsView | undefined {
    return this.views.get(market);
  }

  /** 最後の検索のページが表示に切り替わったか */
  hasCommitted(market: SiteMarket): boolean {
    return this.committed.get(market) === true;
  }

  state(market: SiteMarket): SiteState {
    return this.states.get(market) as SiteState;
  }

  async search(query: string): Promise<void> {
    const q = query.trim().slice(0, 100);
    if (!q) return;
    for (const market of SITE_MARKETS) this.ensureView(market);
    // 読み込みの完了を待たずに、表示中のタブを枠に出す（広告の多いページは完了が遅い）
    this.applyLayout();
    await Promise.all(
      SITE_MARKETS.map(async (market) => {
        const view = this.ensureView(market);
        this.committed.set(market, false);
        this.update(market, { status: 'loading', url: undefined, title: undefined });
        try {
          await view.webContents.loadURL(siteSearchUrl(market, q));
        } catch {
          // 読み込みの失敗は did-fail-load で状態に反映される
        }
      }),
    );
    this.applyLayout();
  }

  setLayout(layout: SiteLayout): void {
    this.layout = layout;
    this.applyLayout();
  }

  private lastBounds: SiteBounds = { x: 0, y: 0, width: 800, height: 700 };

  private applyLayout(): void {
    const { visible, active, bounds } = this.layout;
    if (bounds && bounds.width > 40 && bounds.height > 40) this.lastBounds = roundBounds(bounds);
    for (const [market, view] of this.views) {
      const show = visible && market === active && bounds !== null && bounds.width > 40 && bounds.height > 40;
      // 隠しているタブも同じ大きさにしておく（大きさ0だとサイトが検索結果を描かず、取り込めない）
      view.setBounds(this.lastBounds);
      view.setVisible(show);
    }
  }

  /** ウィンドウを閉じたとき: 実ページを閉じて、裏で動き続けないようにする */
  destroy(): void {
    for (const view of this.views.values()) {
      try {
        if (!this.win.isDestroyed()) this.win.contentView.removeChildView(view);
      } catch {
        // すでに外れている
      }
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
    this.views.clear();
  }

  async goBack(market: SiteMarket): Promise<void> {
    const wc = this.views.get(market)?.webContents;
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  }

  async reload(market: SiteMarket): Promise<void> {
    this.views.get(market)?.webContents.reload();
  }

  async openInBrowser(market: SiteMarket): Promise<void> {
    const url = this.views.get(market)?.webContents.getURL();
    if (url && /^https:\/\//.test(url)) await shell.openExternal(url);
  }
}

function roundBounds(b: SiteBounds): SiteBounds {
  return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
}
