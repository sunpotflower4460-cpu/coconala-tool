import { describe, it, expect } from 'vitest';
import { createManualCard } from './manualCardFactory';
import { parsePriceValue } from './manualCardFactory';
import { MAX_AMOUNT } from '../profit/profitCalculator';

function baseParams(overrides: Partial<Parameters<typeof createManualCard>[0]> = {}) {
  return {
    siteName: '',
    pageUrl: 'https://example.com/item',
    priceText: '',
    ...overrides,
  };
}

describe('createManualCard', () => {
  it('parses a comma-formatted JPY price', () => {
    const card = createManualCard(baseParams({ priceText: '¥12,800' }));
    expect(card.priceValue).toBe(12800);
    expect(card.currency).toBe('JPY');
  });

  it('parses a USD price and tags currency as USD when selected', () => {
    const card = createManualCard(baseParams({ priceText: '$499.99', currency: 'USD' }));
    expect(card.priceValue).toBeCloseTo(499.99, 5);
    expect(card.currency).toBe('USD');
  });

  it('defaults to JPY when currency is not specified', () => {
    const card = createManualCard(baseParams({ priceText: '1000' }));
    expect(card.currency).toBe('JPY');
  });

  it('returns undefined priceValue for non-numeric text', () => {
    const card = createManualCard(baseParams({ priceText: '価格応相談' }));
    expect(card.priceValue).toBeUndefined();
  });

  it('never produces a negative price (minus sign is not captured)', () => {
    const card = createManualCard(baseParams({ priceText: '-500' }));
    expect(card.priceValue).toBe(500);
  });

  it('rejects javascript: pageUrl and imageUrl', () => {
    const card = createManualCard(
      baseParams({
        pageUrl: 'javascript:alert(1)',
        imageUrl: 'javascript:alert(1)',
      }),
    );
    expect(card.pageUrl).toBe('');
    expect(card.imageUrl).toBeUndefined();
  });

  it('caps an absurdly large price at MAX_AMOUNT', () => {
    const card = createManualCard(baseParams({ priceText: '999999999999999' }));
    expect(card.priceValue).toBe(MAX_AMOUNT);
  });

  it('uses the provided title when set', () => {
    const card = createManualCard(baseParams({ title: 'カスタムタイトル', siteName: 'メルカリ' }));
    expect(card.title).toBe('カスタムタイトル');
  });

  it('falls back to a site-derived title when title is blank', () => {
    const card = createManualCard(baseParams({ title: '  ', siteName: 'メルカリ' }));
    expect(card.title).toBe('メルカリ の出品');
  });

  it('falls back to the hostname as site name when the URL has no known pattern', () => {
    const card = createManualCard(baseParams({ pageUrl: 'https://unknown-site.example.com/x' }));
    expect(card.siteName).toBe('unknown-site.example.com');
    expect(card.title).toBe('unknown-site.example.com の出品');
  });

  it('falls back to a generic title when the URL cannot be parsed and no site name is given', () => {
    const card = createManualCard(baseParams({ pageUrl: 'not-a-valid-url' }));
    expect(card.title).toBe('手動追加カード');
  });

  it('全角数字・万/千の単位つき価格を読み、意味が決められない表記は読まない', () => {
    const cases: Array<[string, number | undefined]> = [
      ['¥12,800', 12800],
      ['１２，８００円', 12800],
      ['1.5万円', 15000],
      ['2万5000円', 25000],
      ['2万5千円', 25000],
      ['3千円', 3000],
      ['10万', 100000],
      ['$499.99', 499.99],
      ['送料込み 9,800円', 9800],
      ['12,800〜15,000円', undefined],
      ['3点 12800円', undefined],
      ['価格未定', undefined],
    ];
    for (const [text, expected] of cases) {
      expect([text, parsePriceValue(text)]).toEqual([text, expected]);
    }
  });
});
