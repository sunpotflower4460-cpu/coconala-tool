import type { MarketCard } from '../../types/market';

export type AdapterId = 'rakuten';

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
