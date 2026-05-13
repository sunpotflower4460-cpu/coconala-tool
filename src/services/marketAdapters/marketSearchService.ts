import { ebayAdapter } from './ebayAdapter';
import { mockAdapter } from './mockAdapter';
import { rakutenAdapter } from './rakutenAdapter';
import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';
import { yahooShoppingAdapter } from './yahooShoppingAdapter';

const adapters: MarketAdapter[] = [mockAdapter, ebayAdapter, yahooShoppingAdapter, rakutenAdapter];

export async function searchAcrossAdapters(
  request: MarketSearchRequest,
  selectedAdapters: MarketAdapter[] = adapters,
): Promise<MarketSearchResponse> {
  const responses = await Promise.all(selectedAdapters.map((adapter) => adapter.search(request)));

  return {
    cards: responses.flatMap((response) => response.cards),
    warnings: responses.flatMap((response) => response.warnings ?? []),
  };
}

export function getDefaultAdapters(): MarketAdapter[] {
  return adapters;
}
