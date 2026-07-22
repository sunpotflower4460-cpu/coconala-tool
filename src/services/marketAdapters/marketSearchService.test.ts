import { describe, it, expect } from 'vitest';
import { runMarketSearch } from './marketSearchService';

describe('runMarketSearch (sample mode)', () => {
  it('タイトルの部分一致でカードを絞り込む', async () => {
    const result = await runMarketSearch('PS5', 'sample', 8);
    expect(result.status).toBe('sample');
    expect(result.cards.length).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(card.title.includes('PS5')).toBe(true);
    }
  });

  it('大文字小文字を区別しない', async () => {
    const lower = await runMarketSearch('ebay', 'sample', 8);
    const upper = await runMarketSearch('EBAY', 'sample', 8);
    expect(lower.cards.map((c) => c.id)).toEqual(upper.cards.map((c) => c.id));
    expect(lower.cards.length).toBeGreaterThan(0);
  });

  it('前後の空白を無視する', async () => {
    const trimmed = await runMarketSearch('PS5', 'sample', 8);
    const padded = await runMarketSearch('  PS5  ', 'sample', 8);
    expect(padded.cards.map((c) => c.id)).toEqual(trimmed.cards.map((c) => c.id));
  });

  it('サイト名でも絞り込める', async () => {
    const result = await runMarketSearch('メルカリ', 'sample', 8);
    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards.every((c) => c.siteName === 'メルカリ')).toBe(true);
  });

  it('該当なしの場合は空配列と警告を返す', async () => {
    const result = await runMarketSearch('存在しない商品名zzzzz', 'sample', 8);
    expect(result.status).toBe('sample');
    expect(result.cards).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('サンプルカードには demoOrigin=sample が付与される', async () => {
    const result = await runMarketSearch('PS5', 'sample', 8);
    expect(result.cards.every((c) => c.demoOrigin === 'sample')).toBe(true);
  });

  it('searchedAt を含む', async () => {
    const result = await runMarketSearch('PS5', 'sample', 8);
    expect(typeof result.searchedAt).toBe('string');
    expect(Number.isNaN(Date.parse(result.searchedAt))).toBe(false);
  });
});
