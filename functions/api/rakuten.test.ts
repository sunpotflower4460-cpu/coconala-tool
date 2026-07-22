import { describe, it, expect, vi, afterEach } from 'vitest';
import { onRequest } from './rakuten';

type MockInit = { status?: number; contentType?: string };

function upstreamJsonResponse(body: unknown, init: MockInit = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makeContext(overrides: {
  method?: string;
  search?: string;
  origin?: string;
  appId?: string;
}) {
  const url = `https://example.pages.dev/api/rakuten${overrides.search ?? ''}`;
  const headers = new Headers();
  if (overrides.origin !== undefined) headers.set('origin', overrides.origin);
  const request = new Request(url, { method: overrides.method ?? 'GET', headers });
  return { request, env: { SERVER_RAKUTEN_APP_ID: overrides.appId } };
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe('functions/api/rakuten onRequest', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GET以外は405を返す', async () => {
    const res = await onRequest(makeContext({ method: 'POST', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(405);
    const body = await readJson(res);
    expect(body.error).toBe('method_not_allowed');
  });

  it('同一オリジンでない Origin は403', async () => {
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', origin: 'https://evil.example.com', appId: 'key' }),
    );
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.error).toBe('forbidden_origin');
  });

  it('同一オリジンの Origin は許可される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ Items: [] }));
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', origin: 'https://example.pages.dev', appId: 'key' }),
    );
    expect(res.status).toBe(200);
  });

  it('qが空の場合は400 invalid_query', async () => {
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=', appId: 'key' }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe('invalid_query');
  });

  it('qが100文字を超える場合は400 invalid_query', async () => {
    const longQuery = 'a'.repeat(101);
    const res = await onRequest(makeContext({ method: 'GET', search: `?q=${longQuery}`, appId: 'key' }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe('invalid_query');
  });

  it('キー未設定時は503 no_key を返し、Application ID を含まない', async () => {
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5' }));
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.error).toBe('no_key');
    expect(JSON.stringify(body)).not.toContain('SERVER_RAKUTEN_APP_ID');
  });

  it('limitは1〜30にクランプされる', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(upstreamJsonResponse({ Items: [] }));
    });
    await onRequest(makeContext({ method: 'GET', search: '?q=PS5&limit=999', appId: 'key' }));
    expect(new URL(capturedUrl).searchParams.get('hits')).toBe('30');
  });

  it('上流が429の場合は429 rate_limited', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({}, { status: 429 }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(429);
    const body = await readJson(res);
    expect(body.error).toBe('rate_limited');
  });

  it('上流が5xxの場合は502 upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({}, { status: 500 }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error).toBe('upstream_error');
  });

  it('上流のJSONが不正な形の場合は502 invalid_json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ notItems: true }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error).toBe('invalid_json');
  });

  it('上流がタイムアウトした場合は504 timeout', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const promise = onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    await vi.advanceTimersByTimeAsync(8_000);
    const res = await promise;
    expect(res.status).toBe(504);
    const body = await readJson(res);
    expect(body.error).toBe('timeout');
    vi.useRealTimers();
  });

  it('http のURLは除外し、https のURLのみ通す', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:1',
              itemName: '安全な商品',
              shopName: 'shop',
              itemPrice: 1000,
              mediumImageUrls: [{ imageUrl: 'http://insecure.example.com/a.jpg' }],
              itemUrl: 'http://insecure.example.com/item',
              postageFlag: 0,
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items[0].itemUrl).toBe('');
    expect(body.items[0].mediumImageUrls).toHaveLength(0);
  });

  it('商品名・ショップ名が最大長でクランプされる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:1',
              itemName: 'あ'.repeat(500),
              shopName: 'し'.repeat(500),
              itemPrice: 1000,
              mediumImageUrls: [],
              itemUrl: 'https://item.rakuten.co.jp/shop/1/',
              postageFlag: 0,
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items[0].itemName.length).toBeLessThanOrEqual(200);
    expect(body.items[0].shopName.length).toBeLessThanOrEqual(100);
  });

  it('正常応答には items / source / status / requestId が含まれる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:1',
              itemName: 'PS5 本体',
              shopName: 'shop',
              itemPrice: 79800,
              mediumImageUrls: [{ imageUrl: 'https://example.com/a.jpg' }],
              itemUrl: 'https://item.rakuten.co.jp/shop/1/',
              postageFlag: 0,
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.source).toBe('official_api');
    expect(body.status).toBe('ok');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
    expect(body.items).toHaveLength(1);
  });

  it('レスポンスに Application ID の値が含まれない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ Items: [] }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'super-secret-app-id' }));
    const text = await res.clone().text();
    expect(text).not.toContain('super-secret-app-id');
  });
});
