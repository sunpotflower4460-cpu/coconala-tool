import type { DataSourceMode, MarketSearchResponse } from '../../types/market';
import { rakutenAdapter } from './rakutenAdapter';
import { searchAllMarkets } from './multiMarketSearch';

/**
 * 検索の単一エントリ。`dataSourceMode` に応じて使うデータ経路を切り替える。
 *  - multi       : 楽天・Yahoo!ショッピング・eBay を同時に検索（`multiMarketSearch.ts`）。
 *  - rakuten_mock: 楽天のみ。
 * どちらも、接続できないときは偽の商品を出さず、理由だけを返す。
 */
export async function runMarketSearch(query: string, mode: DataSourceMode, limit = 8): Promise<MarketSearchResponse> {
  if (mode === 'rakuten_mock') return rakutenAdapter.search({ query, limit });
  return searchAllMarkets(query, limit);
}
