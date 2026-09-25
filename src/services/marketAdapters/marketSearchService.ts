import { sampleMarketCards } from '../../data/sampleMarketCards';
import type { DataSourceMode, MarketSearchResponse } from '../../types/market';
import { rakutenAdapter } from './rakutenAdapter';
import { matchesAllKeywords } from '../../lib/keywordMatch';
import { searchAllMarkets } from './multiMarketSearch';
import { detectMarketFromUrl } from '../../features/manualAdd/siteDetector';

const SAMPLE_WARNING =
  'サンプルデータ（UI確認用の固定カード）を表示しています。リアルタイム取得ではありません。';
const SAMPLE_EMPTY_WARNING =
  '該当するサンプルカードが見つかりませんでした。サンプルには「PS5」関連の商品が入っています。検索語を変えるか、「手動で追加」をご利用ください。';

function searchSampleCards(query: string): MarketSearchResponse {
  const matched = sampleMarketCards.filter((card) => matchesAllKeywords(query, [card.title, card.siteName]));

  const warnings = matched.length ? [SAMPLE_WARNING] : [SAMPLE_WARNING, SAMPLE_EMPTY_WARNING];

  return {
    cards: matched.map((card) => ({ ...card, demoOrigin: 'sample' as const, market: card.market ?? detectMarketFromUrl(card.pageUrl) })),
    status: 'sample',
    warnings,
    searchedAt: new Date().toISOString(),
  };
}

/**
 * 検索の単一エントリ。`dataSourceMode` に応じて使うデータ経路を切り替える。
 *  - sample      : UI確認用の固定サンプルカードを検索語で絞り込んで返す。
 *  - rakuten_mock: 楽天のみ（キー設定時は実API、未設定/失敗時は見本データへ切り替え）。
 *  - multi       : 楽天・Yahoo!ショッピング・eBay を同時に検索（`multiMarketSearch.ts`）。
 *
 * 将来 eBay / Yahoo を足す場合も、ここに分岐を追加すれば UI を変えずに載る。
 */
export async function runMarketSearch(
  query: string,
  mode: DataSourceMode,
  limit = 8,
): Promise<MarketSearchResponse> {
  if (mode === 'sample') {
    return searchSampleCards(query);
  }
  if (mode === 'multi') {
    return searchAllMarkets(query, limit);
  }

  return rakutenAdapter.search({ query, limit });
}
