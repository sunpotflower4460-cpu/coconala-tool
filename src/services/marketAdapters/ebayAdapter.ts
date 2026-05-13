import type { MarketAdapter, MarketSearchResponse } from './types';
import { SERVER_ROUTE_NOTICE } from './types';

export const ebayAdapter: MarketAdapter = {
  id: 'ebay',
  label: 'eBay Official API Adapter (stub)',
  sourceType: 'official_api',
  async search(): Promise<MarketSearchResponse> {
    return {
      cards: [],
      warnings: [
        'eBay公式APIアダプターはスキャフォールドのみです。',
        SERVER_ROUTE_NOTICE,
      ],
    };
  },
};
