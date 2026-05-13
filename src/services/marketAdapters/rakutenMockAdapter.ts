import { searchRakutenMockItems } from '../../mocks/rakutenSearchMock';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import type { MarketSearchResponse } from './types';

export async function searchRakutenMockAdapter(query: string, limit = 8): Promise<MarketSearchResponse> {
  const response = searchRakutenMockItems(query, limit);

  return {
    cards: response.Items.map(({ Item }) => mapRakutenItemToMarketCard(Item)),
    warnings: ['楽天市場 公式API取得（モック）を表示しています。'],
  };
}
