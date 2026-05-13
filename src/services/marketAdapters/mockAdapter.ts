import { sampleMarketCards } from '../../data/sampleMarketCards';
import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';

export const mockAdapter: MarketAdapter = {
  id: 'mock',
  label: 'Mock Adapter',
  sourceType: 'search_api',
  async search(request: MarketSearchRequest): Promise<MarketSearchResponse> {
    const normalized = request.query.trim().toLowerCase();
    const filtered = sampleMarketCards.filter((card) =>
      card.title.toLowerCase().includes(normalized),
    );
    const cards = (filtered.length > 0 ? filtered : sampleMarketCards).slice(0, request.limit ?? 8);

    return {
      cards,
      warnings: ['モックデータを返しています。実API接続は未実装です。'],
    };
  },
};
