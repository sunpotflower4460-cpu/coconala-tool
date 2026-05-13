import type { MarketAdapter, MarketSearchResponse } from './types';
import { SERVER_ROUTE_NOTICE } from './types';

export const rakutenAdapter: MarketAdapter = {
  id: 'rakuten',
  label: '楽天商品検索API Adapter (stub)',
  sourceType: 'official_api',
  async search(): Promise<MarketSearchResponse> {
    return {
      cards: [],
      warnings: [
        '楽天商品検索APIアダプターはスキャフォールドのみです。',
        SERVER_ROUTE_NOTICE,
      ],
    };
  },
};
