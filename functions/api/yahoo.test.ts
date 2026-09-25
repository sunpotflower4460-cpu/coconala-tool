import { describe, it, expect, vi, afterEach } from 'vitest';
import { onYahooRequest, resolveYahooEndpoint, YAHOO_ENDPOINT } from './yahoo';

const req = (search: string, init: RequestInit = {}) => new Request(`https://tool.example.workers.dev/api/yahoo${search}`, init);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const env = { SERVER_YAHOO_CLIENT_ID: 'yahoo-client-id-123' };

function capture(body: unknown = { hits: [] }, status = 200) {
  const urls: URL[] = [];
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    urls.push(new URL(url));
    return Promise.resolve(json(body, status));
  });
  return urls;
}

describe('/api/yahoo（Yahoo!ショッピング 商品検索API v3）', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('公式エンドポイントに appid と query・件数を送り、商品を共通形に正規化する（キーは返さない）', async () => {
    const urls = capture({
      hits: [
        {
          code: 'store_item1',
          name: 'PS5 本体',
          url: 'https://store.shopping.yahoo.co.jp/store/item1.html',
          price: 66980,
          image: { medium: 'https://item-shopping.c.yimg.jp/i/g/item1', small: 'https://item-shopping.c.yimg.jp/i/c/item1' },
          seller: { name: 'ストアA' },
          shipping: { name: '送料無料' },
          condition: 'new',
          inStock: true,
        },
        { code: 'sold', name: '売り切れ', url: 'https://store.shopping.yahoo.co.jp/s/sold.html', price: 1, inStock: false },
        { code: 'bad', name: 'http商品', url: 'http://example.com/', price: 100 },
        { code: 'noprice', name: '価格なし', url: 'https://store.shopping.yahoo.co.jp/s/x.html' },
      ],
    });
    const res = await onYahooRequest({ request: req('?q=PS5&limit=5'), env });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(urls[0].origin + urls[0].pathname).toBe(YAHOO_ENDPOINT);
    expect(urls[0].searchParams.get('appid')).toBe('yahoo-client-id-123');
    expect(urls[0].searchParams.get('query')).toBe('PS5');
    expect(urls[0].searchParams.get('results')).toBe('5');
    expect(text).not.toContain('yahoo-client-id-123');
    const body = JSON.parse(text);
    expect(body.items).toEqual([
      {
        id: 'store_item1',
        title: 'PS5 本体',
        shopName: 'ストアA',
        price: 66980,
        currency: 'JPY',
        imageUrl: 'https://item-shopping.c.yimg.jp/i/g/item1',
        url: 'https://store.shopping.yahoo.co.jp/store/item1.html',
        shippingText: '送料無料',
        conditionText: '新品',
      },
    ]);
  });

  it('8桁・13桁の数字は JAN コードとして jan_code で検索する', async () => {
    const urls = capture();
    await onYahooRequest({ request: req('?q=4948872415934'), env });
    expect(urls[0].searchParams.get('jan_code')).toBe('4948872415934');
    expect(urls[0].searchParams.get('query')).toBeNull();
  });

  it('キー未設定は上流へ送らず 503 no_key、別オリジンは 403、POST は 405', async () => {
    const urls = capture();
    expect((await onYahooRequest({ request: req('?q=PS5'), env: {} })).status).toBe(503);
    expect((await onYahooRequest({ request: req('?q=PS5', { headers: { origin: 'https://evil.example' } }), env })).status).toBe(403);
    expect((await onYahooRequest({ request: req('?q=PS5', { method: 'POST' }), env })).status).toBe(405);
    expect((await onYahooRequest({ request: req('?q='), env })).status).toBe(400);
    expect(urls).toHaveLength(0);
  });

  it.each([
    [429, {}, 429, 'rate_limited'],
    [500, {}, 502, 'upstream_error'],
    [401, {}, 502, 'upstream_auth'],
    [403, {}, 502, 'upstream_auth'],
    [400, { Error: { Message: 'Invalid appid' } }, 502, 'upstream_auth'],
    [400, { Error: { Message: 'bad request' } }, 502, 'upstream_client_error'],
  ])('上流 %i は %s 系に分類する', async (upstreamStatus, body, status, code) => {
    capture(body, upstreamStatus as number);
    const res = await onYahooRequest({ request: req('?q=PS5'), env });
    expect(res.status).toBe(status);
    const json = await res.json();
    expect(json.error).toBe(code);
    expect(JSON.stringify(json)).not.toContain('Invalid appid');
  });

  it('hits が無い・壊れた JSON は invalid_json、0件の hits は正常な0件', async () => {
    capture({ totalResultsAvailable: 0 });
    expect((await (await onYahooRequest({ request: req('?q=PS5'), env })).json()).error).toBe('invalid_json');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{"hits":[', { status: 200 }));
    expect((await (await onYahooRequest({ request: req('?q=PS5'), env })).json()).error).toBe('invalid_json');
    capture({ hits: [] });
    expect(await (await onYahooRequest({ request: req('?q=PS5'), env })).json()).toMatchObject({ status: 'ok', items: [] });
  });

  it('8秒以内に応答が無ければ 504 timeout', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    const promise = onYahooRequest({ request: req('?q=PS5'), env });
    await vi.advanceTimersByTimeAsync(8_000);
    expect((await promise).status).toBe(504);
  });

  it('上流の差し替え（E2E用）はフラグ＋ループバックのときだけ効く', () => {
    const fake = 'http://127.0.0.1:43174/ShoppingWebService/V3/itemSearch';
    expect(resolveYahooEndpoint({ E2E_FAKE_UPSTREAM: '1', YAHOO_API_BASE_OVERRIDE: fake })).toBe(fake);
    expect(resolveYahooEndpoint({ YAHOO_API_BASE_OVERRIDE: fake })).toBe(YAHOO_ENDPOINT);
    expect(resolveYahooEndpoint({ E2E_FAKE_UPSTREAM: '1', YAHOO_API_BASE_OVERRIDE: 'https://evil.example/' })).toBe(YAHOO_ENDPOINT);
  });
});
