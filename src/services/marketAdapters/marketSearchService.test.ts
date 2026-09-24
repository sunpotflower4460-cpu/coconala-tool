import { describe, it, expect } from 'vitest';
import { runMarketSearch } from './marketSearchService';

describe('runMarketSearch (sample mode)', () => {
  it('タイトルの部分一致でカードを絞り込み、PS5 と PlayStation 5 を同じ語として扱う', async () => {
    const result = await runMarketSearch('PS5', 'sample', 8);
    expect(result.status).toBe('sample');
    expect(result.cards.length).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(/PS5|PlayStation 5/.test(card.title)).toBe(true);
    }
    const long = await runMarketSearch('PlayStation 5', 'sample', 8);
    expect(long.cards.map((c) => c.id)).toEqual(result.cards.map((c) => c.id));
  });

  it('空白区切りの語はすべて含むカードだけに絞り込む（全角英数も同一視）', async () => {
    const result = await runMarketSearch('ＰＳ５ Digital', 'sample', 8);
    expect(result.cards.length).toBeGreaterThan(0);
    for (const card of result.cards) expect(card.title).toMatch(/Digital|デジタル/i);
  });

  it('楽天モードの見本データは PS5 / ウォークマン / Walkman でもヒットする', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items: [], error: 'no_key' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    try {
      for (const q of ['PS5', 'ウォークマン', 'walkman', 'SONY NW-A55', '3DS']) {
        const result = await runMarketSearch(q, 'rakuten_mock', 8);
        expect([q, result.status, result.cards.length > 0]).toEqual([q, 'mock_no_key', true]);
      }
    } finally {
      globalThis.fetch = originalFetch;
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

  it('URL を検索語にしても例外にせず 0件扱いにできる', async () => {
    const result = await runMarketSearch('https://jp.mercari.com/search?keyword=PS5', 'sample', 8);
    expect(result.status).toBe('sample');
    expect(Array.isArray(result.cards)).toBe(true);
  });
});
