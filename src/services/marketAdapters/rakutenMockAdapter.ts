import { searchRakutenMockItems } from '../../mocks/rakutenSearchMock';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import type { MarketSearchResponse } from './types';

export async function searchRakutenMockAdapter(query: string, limit = 8): Promise<MarketSearchResponse> {
  const response = searchRakutenMockItems(query, limit);

  return {
    cards: response.Items.map(({ Item }) => ({
      ...mapRakutenItemToMarketCard(Item),
      demoOrigin: 'mock' as const,
    })),
    warnings: ['楽天市場の公式API想定モックデータを表示しています（実API未接続）。'],
  };
}
