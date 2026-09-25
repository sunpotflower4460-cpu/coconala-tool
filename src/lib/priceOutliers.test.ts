import { describe, it, expect } from 'vitest';
import { findPriceOutliers } from './priceOutliers';
import type { MarketCard } from '../types/market';

const card = (id: string, priceValue: number, extra: Partial<MarketCard> = {}): MarketCard => ({
  id,
  title: id,
  siteName: 's',
  sourceType: 'official_api',
  pageUrl: 'https://example.com/',
  confidence: 'high',
  createdAt: '',
  priceValue,
  currency: 'JPY',
  ...extra,
});

describe('findPriceOutliers', () => {
  it('本体の相場に混ざったケース（安すぎ）とまとめ売り（高すぎ）を見分ける', () => {
    const cards = [card('a', 58000), card('b', 59000), card('c', 60000), card('d', 61000), card('case', 8080), card('bundle', 240000)];
    const result = findPriceOutliers(cards, 155);
    expect(result.get('case')).toBe('too_low');
    expect(result.get('bundle')).toBe('too_high');
    expect(result.has('a')).toBe(false);
  });

  it('ドル建ては円換算で判定し、手入力の価格と件数が少ないときは判定しない', () => {
    const cards = [card('a', 58000), card('b', 59000), card('c', 60000), card('usd', 380, { currency: 'USD' }), card('m', 1000, { sourceType: 'manual' })];
    const result = findPriceOutliers(cards, 155);
    expect(result.has('usd')).toBe(false); // $380 × 155 = ¥58,900
    expect(result.has('m')).toBe(false);
    expect(findPriceOutliers([card('a', 100), card('b', 50000), card('c', 60000)], 155).size).toBe(0);
  });
});
