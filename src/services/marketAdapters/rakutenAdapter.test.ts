import { describe, it, expect, vi, afterEach } from 'vitest';
import { rakutenAdapter } from './rakutenAdapter';

type MockInit = { status?: number; contentType?: string };

function jsonResponse(body: unknown, init: MockInit = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status < 400,
    status,
    headers: {
      get: (key: string) => (key.toLowerCase() === 'content-type' ? (init.contentType ?? 'application/json') : null),
    },
    json: async () => body,
  } as unknown as Response;
}

function brokenJsonResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    },
  } as unknown as Response;
}

describe('rakutenAdapter.search', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('公式APIから正常取得できた場合、status=official_api でモックにフォールバックしない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            itemCode: 'shop:ps5',
            itemName: 'PS5 本体',
            shopName: 'shop',
            itemPrice: 79800,
            mediumImageUrls: [{ imageUrl: 'https://example.com/a.jpg' }],
            itemUrl: 'https://item.rakuten.co.jp/shop/ps5/',
            postageFlag: 0,
          },
        ],
        source: 'official_api',
      }),
    );

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('official_api');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].demoOrigin).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('0件応答の場合、status=empty でカードが空になる（モックへは切り替えない）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ items: [], source: 'official_api' }));

    const result = await rakutenAdapter.search({ query: 'zzzz-no-result' });

    expect(result.status).toBe('empty');
    expect(result.cards).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('200でもitems配列が無い場合は空検索と誤認せずmock_upstream_errorへフォールバックする', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ source: 'official_api', status: 'ok' }));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_upstream_error');
    expect(result.cards.every((c) => c.demoOrigin === 'mock')).toBe(true);
  });

  it('Content-TypeがJSONでも本文のJSON parseが壊れている場合はmock_upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(brokenJsonResponse());

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_upstream_error');
    expect(result.warnings.join(' ')).toContain('予期しない応答');
  });

  it('キー未設定(no_key)の場合、status=mock_no_key でモックにフォールバックする', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'no_key', items: [] }, { status: 503 }));

    const result = await rakutenAdapter.search({ query: 'SONY' });

    expect(result.status).toBe('mock_no_key');
    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards.every((c) => c.demoOrigin === 'mock')).toBe(true);
    expect(result.warnings.join(' ')).toContain('キー');
  });

  it('429(rate_limited)の場合、status=mock_rate_limited', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'rate_limited', items: [] }, { status: 429 }));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_rate_limited');
  });

  it('5xx(upstream_error)の場合、status=mock_upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'upstream_error', items: [] }, { status: 502 }));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_upstream_error');
  });

  it('サーバー側タイムアウト(timeout)の場合、status=mock_timeout', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'timeout', items: [] }, { status: 504 }));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_timeout');
  });

  it('不正なJSON応答(invalid_json)の場合、status=mock_upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_json', items: [] }, { status: 502 }));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_upstream_error');
  });

  it('非JSON応答の場合、status=mock_upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse('<html>error</html>', { contentType: 'text/html' }));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_upstream_error');
  });

  it('ネットワークエラーの場合、status=mock_network', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('mock_network');
  });

  it('タイムアウトの場合、status=mock_timeout', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const promise = rakutenAdapter.search({ query: 'PS5' });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.status).toBe('mock_timeout');
  });

  it('空クエリではfetchせずemptyを返す', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const result = await rakutenAdapter.search({ query: '   ' });

    expect(result.status).toBe('empty');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('1件の壊れた商品で検索全体を mock_network に落とさず、有効な商品だけ残す', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            itemCode: 'bad',
            itemName: 'broken',
            itemPrice: { toLocaleString: () => { throw new Error('boom'); } },
            itemUrl: 'javascript:alert(1)',
          },
          {
            itemCode: 'shop:ok',
            itemName: '正常な商品',
            shopName: 'shop',
            itemPrice: 1000,
            mediumImageUrls: [],
            itemUrl: 'https://item.rakuten.co.jp/shop/ok/',
            postageFlag: 0,
          },
        ],
        source: 'official_api',
      }),
    );

    const result = await rakutenAdapter.search({ query: 'PS5' });

    expect(result.status).toBe('official_api');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe('rakuten-shop:ok');
  });

  it('商品は返ってきたが1件もカード化できない場合は empty と誤認せず mock_upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ itemCode: 'x', itemName: 'no-url', itemPrice: 1, itemUrl: 'javascript:alert(1)' }],
        source: 'official_api',
      }),
    );

    const result = await rakutenAdapter.search({ query: 'PS5' });
    expect(result.status).toBe('mock_upstream_error');
  });

  it('モックにフォールバックしても該当がない場合、候補キーワードの案内を含む', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'no_key', items: [] }, { status: 503 }));

    const result = await rakutenAdapter.search({ query: '存在しないキーワードzzzz' });

    expect(result.status).toBe('mock_no_key');
    expect(result.cards).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('PS5'))).toBe(true);
  });

  it('不正価格の商品だけ除外し、検索全体は成功して ¥0 へ変換しない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            itemCode: 'shop:ok1',
            itemName: '正常1',
            shopName: 'shop',
            itemPrice: 79800,
            mediumImageUrls: [],
            itemUrl: 'https://item.rakuten.co.jp/shop/ok1/',
            postageFlag: 0,
          },
          {
            itemCode: 'shop:undef',
            itemName: '価格なし',
            shopName: 'shop',
            itemUrl: 'https://item.rakuten.co.jp/shop/undef/',
            postageFlag: 0,
          },
          {
            itemCode: 'shop:abc',
            itemName: '文字価格',
            shopName: 'shop',
            itemPrice: 'abc',
            itemUrl: 'https://item.rakuten.co.jp/shop/abc/',
            postageFlag: 0,
          },
          {
            itemCode: 'shop:nan',
            itemName: 'NaN価格',
            shopName: 'shop',
            itemPrice: Number.NaN,
            itemUrl: 'https://item.rakuten.co.jp/shop/nan/',
            postageFlag: 0,
          },
          {
            itemCode: 'shop:ok2',
            itemName: '正常2',
            shopName: 'shop',
            itemPrice: 1200,
            mediumImageUrls: [],
            itemUrl: 'https://item.rakuten.co.jp/shop/ok2/',
            postageFlag: 0,
          },
        ],
        source: 'official_api',
      }),
    );

    const result = await rakutenAdapter.search({ query: 'PS5' });
    expect(result.status).toBe('official_api');
    expect(result.cards.map((card) => card.id)).toEqual(['rakuten-shop:ok1', 'rakuten-shop:ok2']);
    expect(result.cards.every((card) => card.priceValue !== 0)).toBe(true);
  });

  it.each([
    ['null', null],
    ['string', 'hello'],
    ['number', 123],
    ['array', []],
    ['empty object', {}],
  ] as const)('HTTP 200 JSON が %s のときは mock_upstream_error（network ではない）', async (_label, body) => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await rakutenAdapter.search({ query: 'PS5' });
    expect(result.status).toBe('mock_upstream_error');
    expect(result.cards.every((card) => card.demoOrigin === 'mock')).toBe(true);
  });

  it('{ items: [] } は正常な empty 検索として扱う', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const result = await rakutenAdapter.search({ query: 'PS5' });
    expect(result.status).toBe('empty');
    expect(result.cards).toHaveLength(0);
  });
});
