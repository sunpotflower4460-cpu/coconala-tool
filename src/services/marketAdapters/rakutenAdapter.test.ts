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

  it('モックにフォールバックしても該当がない場合、候補キーワードの案内を含む', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'no_key', items: [] }, { status: 503 }));

    const result = await rakutenAdapter.search({ query: '存在しないキーワードzzzz' });

    expect(result.status).toBe('mock_no_key');
    expect(result.cards).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('PS5'))).toBe(true);
  });
});
