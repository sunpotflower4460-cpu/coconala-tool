import { describe, it, expect } from 'vitest';
import { calcFee, calcProfit, calcMargin, profitBadge, toJpyPrice, clampAmount, clampFeeRate, MAX_AMOUNT } from './profitCalculator';
import type { MarketCard } from '../../types/market';

function makeCard(overrides: Partial<MarketCard>): MarketCard {
  return {
    id: 'test',
    title: 'Test',
    siteName: 'Test',
    sourceType: 'manual',
    pageUrl: 'https://example.com/item',
    confidence: 'high',
    createdAt: '2026-06-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('profitCalculator', () => {
  it('calculates fee, profit and margin for a normal case', () => {
    // sell 10000, fee 10% = 1000, buy 6000, shipping 500 => profit 2500
    expect(calcFee(10000, 10)).toBe(1000);
    const profit = calcProfit(10000, 6000, 500, 10);
    expect(profit).toBe(2500);
    expect(calcMargin(profit, 10000)).toBeCloseTo(25, 5);
  });

  it('returns 0 margin when sell price is 0 (no divide-by-zero)', () => {
    expect(calcMargin(0, 0)).toBe(0);
  });

  it('flags 利益薄い when profit is negative', () => {
    // sell 5000, fee 10% = 500, buy 6000 => profit -1500
    const profit = calcProfit(5000, 6000, 0, 10);
    expect(profit).toBeLessThan(0);
    expect(profitBadge(profit, calcMargin(profit, 5000)).label).toBe('利益薄い');
  });

  it('flags 要確認 (warning) when profit is positive but margin is under the safe threshold', () => {
    // sell 10000, fee 10% = 1000, buy 8000, shipping 100 => profit 900 (margin 9% < 15%)
    const profit = calcProfit(10000, 8000, 100, 10);
    const margin = calcMargin(profit, 10000);
    expect(profit).toBeGreaterThan(0);
    expect(margin).toBeLessThan(10);
    expect(profitBadge(profit, margin).label).toBe('要確認');
  });

  it('flags 狙い目 when profit is healthy', () => {
    const profit = calcProfit(10000, 5000, 0, 10);
    const margin = calcMargin(profit, 10000);
    expect(margin).toBeGreaterThanOrEqual(15);
    expect(profitBadge(profit, margin).label).toBe('狙い目');
  });

  it('handles a 0円 case without error', () => {
    expect(calcProfit(0, 0, 0, 10)).toBe(0);
    expect(calcMargin(0, 0)).toBe(0);
  });

  it('handles 100% fee rate (all sell price consumed by fee)', () => {
    expect(calcFee(10000, 100)).toBe(10000);
    expect(calcProfit(10000, 0, 0, 100)).toBe(0);
  });

  it('handles decimal prices', () => {
    expect(calcFee(1000.5, 10)).toBeCloseTo(100.05, 5);
  });

  describe('clampAmount', () => {
    it('rejects negative values (clamps to 0)', () => {
      expect(clampAmount(-500)).toBe(0);
    });

    it('rejects NaN and Infinity', () => {
      expect(clampAmount(NaN)).toBe(0);
      expect(clampAmount(Infinity)).toBe(0);
      expect(clampAmount(-Infinity)).toBe(0);
    });

    it('caps extremely large values at MAX_AMOUNT', () => {
      expect(clampAmount(MAX_AMOUNT * 10)).toBe(MAX_AMOUNT);
    });

    it('passes through valid values unchanged', () => {
      expect(clampAmount(12345.5)).toBe(12345.5);
    });
  });

  describe('clampFeeRate', () => {
    it('rejects negative values (clamps to 0)', () => {
      expect(clampFeeRate(-10)).toBe(0);
    });

    it('caps values above 100', () => {
      expect(clampFeeRate(250)).toBe(100);
    });

    it('rejects NaN', () => {
      expect(clampFeeRate(NaN)).toBe(0);
    });

    it('passes through valid values unchanged', () => {
      expect(clampFeeRate(12.5)).toBe(12.5);
    });
  });

  describe('toJpyPrice', () => {
    it('converts USD cards using the exchange rate', () => {
      const card = makeCard({ priceValue: 100, currency: 'USD' });
      expect(toJpyPrice(card, 155)).toBe(15500);
    });

    it('keeps JPY cards as-is (rounded)', () => {
      const card = makeCard({ priceValue: 79980, currency: 'JPY' });
      expect(toJpyPrice(card, 155)).toBe(79980);
    });

    it('returns undefined when there is no numeric price', () => {
      const card = makeCard({ priceValue: undefined, currency: 'JPY' });
      expect(toJpyPrice(card, 155)).toBeUndefined();
    });
  });
});
