import type { MarketSearchResponse } from '../../types/market';

export type { MarketSearchResponse };

export type AdapterId = 'rakuten';

export type MarketSearchRequest = {
  query: string;
  limit?: number;
};

export interface MarketAdapter {
  id: AdapterId;
  label: string;
  sourceType: 'official_api' | 'search_api';
  search(request: MarketSearchRequest): Promise<MarketSearchResponse>;
}
