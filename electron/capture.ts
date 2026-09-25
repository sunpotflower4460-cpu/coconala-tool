/**
 * 「表示中の値段を取り込む」: 利用者がボタンを押したときだけ、各タブに表示中の検索ページ1枚から、
 * 商品ページへのリンクと、そのリンクを含む枠の文字だけを読む（画像・説明文・出品者情報は読まない）。
 * ページのスクリプトから触られないよう、ページとは別の実行環境（isolated world）で読む。
 * 値段・商品名の判定は画面側の `src/lib/pageCapture.ts`。
 */
import type { CaptureResult, CaptureSettings, CapturedEntry, SiteMarket } from '../src/lib/desktopBridge';
import { SITE_MARKETS } from '../src/lib/desktopBridge';
import { ITEM_URL_PATTERNS, MAX_CAPTURED_PER_SITE } from '../src/lib/pageCapture';
import type { SiteViews } from './siteViews';

const ISOLATED_WORLD_ID = 1717;
const MAX_TEXT = 600;

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
      const img = a.querySelector('img[alt]');
      const label = (img && img.getAttribute('alt')) || a.getAttribute('title') || a.getAttribute('aria-label') || '';
      found.set(key, { url: key, text: String(box.innerText || '').slice(0, ${MAX_TEXT}), label: String(label).slice(0, 200) });
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
        const raw = await view.webContents.executeJavaScriptInIsolatedWorld(ISOLATED_WORLD_ID, [
          { code: captureScript(ITEM_URL_PATTERNS[market], MAX_CAPTURED_PER_SITE + 10) },
        ]);
        return { market, ok: true, entries: sanitizeEntries(raw) };
      } catch {
        return { market, ok: false, entries: [], reason: 'error' };
      }
    }),
  );
}
