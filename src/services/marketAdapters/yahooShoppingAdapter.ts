import type { MarketAdapter, MarketSearchResponse } from './types';
import { SERVER_ROUTE_NOTICE } from './types';

export const yahooShoppingAdapter: MarketAdapter = {
  id: 'yahooShopping',
  label: 'Yahoo!ショッピングAPI Adapter (stub)',
  sourceType: 'official_api',
  async search(): Promise<MarketSearchResponse> {
    return {
      cards: [],
      warnings: [
        'Yahoo!ショッピング公式APIアダプターはスキャフォールドのみです。',
        SERVER_ROUTE_NOTICE,
      ],
    };
  },
};
