/**
 * 「表示中の値段を取り込む」: 利用者がボタンを押したときだけ、各タブに表示中の検索ページ1枚から、
 * 商品ページへのリンクと、そのリンクを含む枠の文字だけを読む（画像・説明文・出品者情報は読まない）。
 * ページのスクリプトから触られないよう、ページとは別の実行環境（isolated world）で読む。
 * ただし広告などの読み込みが終わらないページでは、その方法だと読み込み完了まで待たされるため、
 * 表示中の内容をそのまま読む（mainFrame）。どちらも読み取った値は下の sanitizeEntries で検査してから使う。
 * 値段・商品名の判定は画面側の `src/lib/pageCapture.ts`。
 */
import type { CaptureResult, CaptureSettings, CapturedEntry, SiteMarket } from '../src/lib/desktopBridge';
import { SITE_MARKETS } from '../src/lib/desktopBridge';
import { ITEM_URL_PATTERNS, MAX_CAPTURED_PER_SITE } from '../src/lib/pageCapture';
import type { SiteViews } from './siteViews';

const ISOLATED_WORLD_ID = 1717;
const MAX_TEXT = 600;
/** 広告の読み込みが終わらないページでも待ち続けないよう、1サイトあたりの上限時間 */
const CAPTURE_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function captureScript(pattern: string, limit: number): string {
  return `(() => {
    const pattern = new RegExp(${JSON.stringify(pattern)});
    const keyOf = (href) => { const m = pattern.exec(href); return m ? m[0] : null; };
    const anchors = Array.from(document.querySelectorAll('a[href]')).filter((a) => keyOf(a.href));
    const found = new Map();
    for (const a of anchors) {
      const key = keyOf(a.href);
      if (!key || found.has(key)) continue;
      // リンクを含む枠を、別の商品のリンクが入らない範囲で広げる（値段がリンクの外に書かれるサイト向け）
      let box = a;
      for (let depth = 0; depth < 6 && box.parentElement; depth += 1) {
        const parent = box.parentElement;
        const hasOther = Array.from(parent.querySelectorAll('a[href]')).some((x) => { const k = keyOf(x.href); return k && k !== key; });
        if (hasOther) break;
        box = parent;
      }
      // 商品名の候補: 画像の代替テキスト・読み上げ用ラベル（メルカリ等は商品名と値段をここに持つ）・リンクの文字
      const sameItem = Array.from(box.querySelectorAll('a[href]')).filter((x) => keyOf(x.href) === key);
      const labels = [];
      for (const link of sameItem) {
        for (const el of [link, ...Array.from(link.querySelectorAll('img[alt], [aria-label], [title]'))]) {
          for (const v of [el.getAttribute('alt'), el.getAttribute('aria-label'), el.getAttribute('title')]) if (v) labels.push(v.trim());
        }
        const t = String(link.innerText || '').trim();
        if (t) labels.push(t.split('\\n')[0]);
      }
      const label = labels.filter((v) => v.length >= 4).sort((x, y) => y.length - x.length)[0] || '';
      const ariaText = Array.from(box.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label')).join('\\n');
      found.set(key, { url: key, text: (String(box.innerText || '') + '\\n' + ariaText).slice(0, ${MAX_TEXT}), label: String(label).slice(0, 200) });
      if (found.size >= ${limit}) break;
    }
    return Array.from(found.values());
  })()`;
}

function sanitizeEntries(value: unknown): CapturedEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is CapturedEntry => Boolean(e) && typeof e.url === 'string' && typeof e.text === 'string' && typeof e.label === 'string')
    .slice(0, MAX_CAPTURED_PER_SITE + 10)
    .map((e) => ({ url: e.url.slice(0, 500), text: e.text.slice(0, MAX_TEXT), label: e.label.slice(0, 200) }));
}

export async function captureVisiblePages(views: SiteViews, settings: CaptureSettings): Promise<CaptureResult[]> {
  return Promise.all(
    SITE_MARKETS.map(async (market: SiteMarket): Promise<CaptureResult> => {
      if (!settings[market]) return { market, ok: false, entries: [], reason: 'disabled' };
      const view = views.view(market);
      const state = views.state(market);
      if (!view || state.status === 'idle') return { market, ok: false, entries: [], reason: 'not_loaded' };
      try {
        const code = captureScript(ITEM_URL_PATTERNS[market], MAX_CAPTURED_PER_SITE + 10);
        const wc = view.webContents;
        const raw = await withTimeout(
          wc.isLoadingMainFrame() ? wc.mainFrame.executeJavaScript(code) : wc.executeJavaScriptInIsolatedWorld(ISOLATED_WORLD_ID, [{ code }]),
          CAPTURE_TIMEOUT_MS,
        );
        return { market, ok: true, entries: sanitizeEntries(raw) };
      } catch {
        return { market, ok: false, entries: [], reason: 'error' };
      }
    }),
  );
}
