import type { MarketCard } from '../../types/market';

export type AdapterId = 'mock' | 'ebay' | 'yahooShopping' | 'rakuten';

export type MarketSearchRequest = {
  query: string;
  limit?: number;
};

export type MarketSearchResponse = {
  cards: MarketCard[];
  warnings?: string[];
};

export interface MarketAdapter {
  id: AdapterId;
  label: string;
  sourceType: 'official_api' | 'search_api';
  search(request: MarketSearchRequest): Promise<MarketSearchResponse>;
}

export const SERVER_ROUTE_NOTICE =
  '本番では API キー保護のため、公式API呼び出しはサーバー/Worker経由で実装してください。';
