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
    } else if (r.reason === 'loading') {
      anyWarn = true;
      lines.push(`${label}: まだ読み込み中です。少し待ってからもう一度押してください`);
    } else if (r.reason === 'not_search_page') {
      anyWarn = true;
      lines.push(`${label}: 検索結果以外のページを表示中です。右のタブで「←」を押して検索結果に戻してから押してください`);
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
  if (!desktop || ui.capturing || useResearchStore.getState().isSearching) return;
  // 取り込み中に新しく検索された場合、古い検索の値段を新しい結果に混ぜないための目印
  const searchedAt = useResearchStore.getState().lastSearchedAt;
  const query = useResearchStore.getState().searchedQuery;
  ui.setCapturing(true);
  ui.setCaptureNotice(null);
  try {
    const results = await desktop.sites.capture();
    if (useResearchStore.getState().lastSearchedAt !== searchedAt) return;
    const counts = new Map<string, number>();
    for (const r of results) {
      if (!SITE_MARKETS.includes(r.market)) continue;
      const cards = r.ok ? parseCapturedEntries(r.market, r.entries, query) : [];
      counts.set(r.market, cards.length);
      if (r.ok) useResearchStore.getState().setCapturedCards(r.market, cards);
    }
    useDesktopUi.getState().setCaptureNotice(describeCapture(results, counts));
  } catch {
    useDesktopUi.getState().setCaptureNotice({ lines: ['取り込みに失敗しました。少し待ってから、もう一度押してください。'], kind: 'warn' });
  } finally {
    useDesktopUi.getState().setCapturing(false);
  }
}
