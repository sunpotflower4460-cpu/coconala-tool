import { useResearchStore } from '../../store/researchStore';
import { runMarketSearch } from '../../services/marketAdapters/marketSearchService';

/**
 * 今の検索語・データソースで検索し、結果をストアへ反映する（検索ボタン・Enter・「PS5 で試してみる」で共通）。
 * 検索中の二重送信、途中で検索語やデータソースが変わった場合・クリア後の古い応答は捨てる。
 */
export async function performSearch(): Promise<void> {
  const { query, dataSourceMode } = useResearchStore.getState();
  const requestedQuery = query.trim();
  const requestedMode = dataSourceMode;
  if (!requestedQuery) return;

  const requestId = useResearchStore.getState().beginSearch();
  if (requestId === null) return;

  try {
    const response = await runMarketSearch(requestedQuery, requestedMode, 8);
    const current = useResearchStore.getState();
    // 同一クエリでも、クリア後の再検索や連打で生まれた古い世代は捨てる。
    if (!current.isCurrentSearchRequest(requestId)) return;
    if (current.query.trim() !== requestedQuery || current.dataSourceMode !== requestedMode) return;
    current.setSearchResult(response, requestedQuery);
  } finally {
    useResearchStore.getState().finishSearchIfCurrent(requestId);
  }
}
