import { describe, it, expect, afterEach, vi } from 'vitest';
import { runMarketSearch } from './marketSearchService';

function stubFetch(handler: (url: string) => Response) {
  vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('runMarketSearch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('楽天モードで接続できないときは偽の商品を出さず、理由と貼り付けの案内だけを返す', async () => {
    stubFetch(() => json({ items: [], error: 'no_key' }, 503));
    for (const q of ['PS5', 'ウォークマン', 'Nintendo Switch 2']) {
      const result = await runMarketSearch(q, 'rakuten_mock', 8);
      expect(result.status).toBe('mock_no_key');
      expect(result.cards).toEqual([]);
      expect(result.warnings.join('\n')).toMatch(/貼り付け/);
      expect(result.warnings.join('\n')).not.toMatch(/見本|サンプル/);
    }
  });

  it('まとめてモードで全サイトが失敗しても偽の商品を出さない', async () => {
    stubFetch(() => json({ items: [], error: 'no_key' }, 503));
    const result = await runMarketSearch('PS5', 'multi', 8);
    expect(result.cards).toEqual([]);
    expect(result.status).toBe('mock_no_key');
    expect(result.sources?.every((s) => s.outcome === 'failed')).toBe(true);
    expect(result.warnings.join('\n')).toMatch(/貼り付け/);
    expect(result.warnings.join('\n')).not.toMatch(/見本|サンプル/);
  });

  it('まとめてモードで一部のサイトだけ成功したら、その実データだけを並べる', async () => {
    stubFetch((url) =>
      url.startsWith('/api/rakuten')
        ? json({
            items: [
              {
                itemCode: 'shop:1',
                itemName: 'PS5 本体',
                shopName: 'ショップ',
                itemPrice: 79800,
                mediumImageUrls: [],
                itemUrl: 'https://item.rakuten.co.jp/shop/1/',
                postageFlag: 0,
              },
            ],
          })
        : json({ items: [], error: 'no_key' }, 503),
    );
    const result = await runMarketSearch('PS5', 'multi', 8);
    expect(result.status).toBe('official_api');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].demoOrigin).toBeUndefined();
  });

  it('searchedAt を含む', async () => {
    stubFetch(() => json({ items: [] }));
    const result = await runMarketSearch('PS5', 'multi', 8);
    expect(Number.isNaN(Date.parse(result.searchedAt))).toBe(false);
  });
});
