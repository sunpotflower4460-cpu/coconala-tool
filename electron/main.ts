/**
 * 相場カード比較ボード デスクトップアプリの本体（Electron の main プロセス）。
 *
 *  - 画面（React）は独自スキーム app://bundle/ で配信する。/api/rakuten・/api/yahoo・/api/ebay は
 *    Web 版と同じ worker.ts をこの中で動かして処理し、キーは keyStore（OS の暗号化保管）から渡す。
 *  - メルカリ等の実ページは siteViews（右側のタブ）で表示し、取り込みは利用者の操作時だけ（capture.ts）。
 *  - 画面側に公開するのは preload.ts の `window.desktop` だけ（Node の機能は渡さない）。
 */
import { app, BrowserWindow, ipcMain, net, protocol, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import worker from '../worker';
import type { WorkerEnv } from '../worker';
import { KeyStore } from './keyStore';
import { SiteViews } from './siteViews';
import { captureVisiblePages } from './capture';
import type { CaptureSettings, KeyInput, KeySite, KeyTestResult, SiteLayout, SiteMarket } from '../src/lib/desktopBridge';
import { SITE_MARKETS } from '../src/lib/desktopBridge';

const IS_TEST = process.env.E2E_FAKE_UPSTREAM === '1';
if (IS_TEST && process.env.E2E_USER_DATA) app.setPath('userData', process.env.E2E_USER_DATA);

const APP_ORIGIN = 'app://bundle';
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
  `img-src 'self' https: data:${IS_TEST && process.env.E2E_IMAGE_BASE ? ` ${process.env.E2E_IMAGE_BASE}` : ''}; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } },
]);

const keyStore = new KeyStore();
let mainWindow: BrowserWindow | null = null;
let siteViews: SiteViews | null = null;

// ---------- 設定（取り込みのオン・オフ） ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readCaptureSettings(): CaptureSettings {
  const defaults = Object.fromEntries(SITE_MARKETS.map((m) => [m, true])) as CaptureSettings;
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf-8')) as { capture?: Partial<CaptureSettings> };
    for (const m of SITE_MARKETS) if (typeof saved.capture?.[m] === 'boolean') defaults[m] = saved.capture[m] as boolean;
  } catch {
    // 初回は既定（すべてオン）
  }
  return defaults;
}
function writeCaptureSettings(settings: CaptureSettings): void {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ capture: settings }));
}

// ---------- app:// の配信 ----------
function withSecurityHeaders(res: Response, extra: Record<string, string> = {}): Response {
  const headers = new Headers(res.headers);
  headers.set('content-security-policy', CSP);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

async function callWorker(pathname: string, search: string, method = 'GET'): Promise<Response> {
  // Worker の同一オリジン検査を通すため、画面からの要求を https の擬似URLへ置き換えて渡す（Origin は付けない）
  const request = new Request(`https://desktop.app${pathname}${search}`, { method, headers: { accept: 'application/json' } });
  return worker.fetch(request, keyStore.workerEnv() as WorkerEnv);
}

async function handleAppProtocol(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.host !== 'bundle') return new Response('Not found', { status: 404 });
  if (url.pathname.startsWith('/api/')) return callWorker(url.pathname, url.search, request.method);

  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.resolve(RENDERER_DIR, relative);
  if (!file.startsWith(RENDERER_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(RENDERER_DIR, 'index.html');
  const res = await net.fetch(pathToFileURL(file).toString());
  return withSecurityHeaders(res);
}

// ---------- キーのテスト ----------
const TEST_PATH: Record<KeySite, string> = { rakuten: '/api/rakuten', yahoo: '/api/yahoo', ebay: '/api/ebay' };
async function testKey(site: KeySite): Promise<KeyTestResult> {
  try {
    const res = await callWorker(TEST_PATH[site], `?q=${encodeURIComponent('Nintendo Switch')}&limit=1`);
    const body = (await res.json()) as { items?: unknown[]; error?: string };
    if (res.ok && Array.isArray(body.items)) return { ok: true, count: body.items.length };
    return { ok: false, code: typeof body.error === 'string' ? body.error : 'upstream_error' };
  } catch {
    return { ok: false, code: 'fetch_failed' };
  }
}

// ---------- 入力の検査 ----------
const isKeySite = (v: unknown): v is KeySite => v === 'rakuten' || v === 'yahoo' || v === 'ebay';
const isSiteMarket = (v: unknown): v is SiteMarket => SITE_MARKETS.includes(v as SiteMarket);
function isLayout(v: unknown): v is SiteLayout {
  if (!v || typeof v !== 'object') return false;
  const l = v as SiteLayout;
  const b = l.bounds;
  const boundsOk =
    b === null || (b && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite((b as Record<string, number>)[k])));
  return typeof l.visible === 'boolean' && (l.active === null || isSiteMarket(l.active)) && Boolean(boundsOk);
}

/** 自動テスト・マニュアル撮影用: 画像の読み込み先を偽サーバーへ向ける（フラグ＋ループバック限定。本番では効かない） */
function redirectTestImages(): void {
  const base = process.env.E2E_IMAGE_BASE;
  if (!IS_TEST || !base || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) return;
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://placehold.co/*'] }, (details, callback) => {
    const url = new URL(details.url);
    callback({ redirectURL: `${base}/__placehold${url.pathname}${url.search}` });
  });
}

function registerIpc(): void {
  ipcMain.handle('keys:status', () => keyStore.status());
  ipcMain.handle('keys:save', (_e, input: KeyInput) => keyStore.save(input && typeof input === 'object' ? input : {}));
  ipcMain.handle('keys:clear', (_e, site: unknown) => (isKeySite(site) ? keyStore.clear(site) : keyStore.status()));
  ipcMain.handle('keys:test', (_e, site: unknown) => (isKeySite(site) ? testKey(site) : { ok: false, code: 'invalid' }));

  ipcMain.handle('sites:search', (_e, query: unknown) => (typeof query === 'string' ? siteViews?.search(query) : undefined));
  ipcMain.on('sites:layout', (_e, layout: unknown) => {
    if (isLayout(layout)) siteViews?.setLayout(layout);
  });
  ipcMain.handle('sites:capture', () => (siteViews ? captureVisiblePages(siteViews, readCaptureSettings()) : []));
  ipcMain.handle('sites:back', (_e, m: unknown) => (isSiteMarket(m) ? siteViews?.goBack(m) : undefined));
  ipcMain.handle('sites:reload', (_e, m: unknown) => (isSiteMarket(m) ? siteViews?.reload(m) : undefined));
  ipcMain.handle('sites:openInBrowser', (_e, m: unknown) => (isSiteMarket(m) ? siteViews?.openInBrowser(m) : undefined));
  ipcMain.handle('sites:captureSettings', () => readCaptureSettings());
  ipcMain.handle('sites:setCaptureEnabled', (_e, m: unknown, enabled: unknown) => {
    const settings = readCaptureSettings();
    if (isSiteMarket(m) && typeof enabled === 'boolean') {
      settings[m] = enabled;
      writeCaptureSettings(settings);
    }
    return settings;
  });

  ipcMain.handle('app:openExternal', async (_e, url: unknown) => {
    if (typeof url === 'string' && /^https:\/\//.test(url) && url.length < 2000) await shell.openExternal(url);
  });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: '相場カード比較ボード',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  const wc = mainWindow.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) {
      event.preventDefault();
      if (/^https:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  siteViews = new SiteViews(mainWindow, (states) => {
    if (!wc.isDestroyed()) wc.send('sites:state', states);
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
    siteViews = null;
  });
  void mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    protocol.handle('app', handleAppProtocol);
    redirectTestImages();
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
