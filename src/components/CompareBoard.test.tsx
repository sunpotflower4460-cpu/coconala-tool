import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompareBoard } from './CompareBoard';
import { useResearchStore } from '../store/researchStore';
import type { MarketCard } from '../types/market';

function usdCard(): MarketCard {
  return {
    id: 'usd-1',
    title: 'USD item',
    siteName: 'eBay',
    sourceType: 'manual',
    priceText: '$100',
    priceValue: 100,
    currency: 'USD',
    pageUrl: 'https://www.ebay.com/itm/1',
    confidence: 'high',
    createdAt: '2026-08-31T00:00:00.000Z',
  };
}

describe('CompareBoard', () => {
  beforeEach(() => {
    useResearchStore.setState({
      comparedCards: [usdCard()],
      profitSettings: {
        buyPrice: 0,
        sellPrice: 0,
        shippingCost: 0,
        feeRate: 10,
        exchangeRate: 0,
      },
    });
  });

  it('為替レート 0 のときは USD を仕入れ/販売に使えない', () => {
    render(<CompareBoard />);
    expect(screen.getByRole('button', { name: 'この価格を仕入れに使う' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'この価格を販売に使う' })).toBeDisabled();
    expect(screen.queryByText(/円換算/)).not.toBeInTheDocument();
  });
});
