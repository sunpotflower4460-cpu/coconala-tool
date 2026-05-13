import type { MarketAdapter, MarketSearchResponse } from './types';
import { SERVER_ROUTE_NOTICE } from './types';

export const yahooShoppingAdapter: MarketAdapter = {
  id: 'yahooShopping',
  label: 'YahooショッピングAPI Adapter (stub)',
  sourceType: 'official_api',
  async search(): Promise<MarketSearchResponse> {
    return {
      cards: [],
      warnings: [
        'Yahooショッピング公式APIアダプターはスキャフォールドのみです。',
        SERVER_ROUTE_NOTICE,
      ],
    };
  },
};
