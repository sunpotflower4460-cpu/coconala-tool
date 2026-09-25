import { getDesktop, SITE_MARKETS, type CaptureResult } from '../../lib/desktopBridge';
import { parseCapturedEntries } from '../../lib/pageCapture';
import { MARKET_LABELS } from '../../types/market';
import { useResearchStore } from '../../store/researchStore';
import { useDesktopUi } from './desktopUiStore';

/** 取り込み結果を、利用者向けの短いお知らせに変える。 */
export function describeCapture(results: CaptureResult[], counts: Map<string, number>): { lines: string[]; kind: 'ok' | 'warn' } {
  const lines: string[] = [];
  let anyWarn = false;
  for (const r of results) {
    const label = MARKET_LABELS[r.market];
    const count = counts.get(r.market) ?? 0;
    if (r.reason === 'disabled') lines.push(`${label}: 取り込みをオフにしています（設定で変更できます）`);
    else if (r.reason === 'not_loaded') {
      anyWarn = true;
      lines.push(`${label}: まだページを開いていません`);
    } else if (!r.ok) {
      anyWarn = true;
      lines.push(`${label}: 読み取れませんでした。右のタブで値段を確認してください`);
    } else if (count === 0) {
      anyWarn = true;
      lines.push(`${label}: 値段を読み取れませんでした（ログインや確認画面が出ていないか、右のタブで確認してください）`);
    } else lines.push(`${label}: ${count}件`);
  }
  return { lines, kind: anyWarn ? 'warn' : 'ok' };
}

/** 「表示中の値段を取り込む」: 右のタブに表示中の各サイトから値段と商品リンクを読み、一覧に並べる。 */
export async function captureVisiblePrices(): Promise<void> {
  const desktop = getDesktop();
  const ui = useDesktopUi.getState();
  if (!desktop || ui.capturing) return;
  ui.setCapturing(true);
  ui.setCaptureNotice(null);
  try {
    const results = await desktop.sites.capture();
    const query = useResearchStore.getState().searchedQuery;
    const counts = new Map<string, number>();
    for (const r of results) {
      if (!SITE_MARKETS.includes(r.market)) continue;
      const cards = r.ok ? parseCapturedEntries(r.market, r.entries, query) : [];
      counts.set(r.market, cards.length);
      if (r.ok) useResearchStore.getState().setCapturedCards(r.market, cards);
    }
    useDesktopUi.getState().setCaptureNotice(describeCapture(results, counts));
  } catch {
    useDesktopUi.getState().setCaptureNotice({ lines: ['取り込みに失敗しました。もう一度お試しください。'], kind: 'warn' });
  } finally {
    useDesktopUi.getState().setCapturing(false);
  }
}
