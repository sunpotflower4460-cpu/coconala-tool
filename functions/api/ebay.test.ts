import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { onEbayRequest, resetEbayTokenCache, EBAY_OAUTH_ENDPOINT, EBAY_SEARCH_ENDPOINT } from './ebay';

const req = (search: string, init: RequestInit = {}) => new Request(`https://tool.example.workers.dev/api/ebay${search}`, init);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const env = { SERVER_EBAY_CLIENT_ID: 'ebay-client-id', SERVER_EBAY_CLIENT_SECRET: 'ebay-client-secret' };

type Call = { url: URL; init: RequestInit };

function mockEbay(searchBody: unknown = { total: 0 }, searchStatus = 200, tokenStatus = 200) {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    calls.push({ url: new URL(url), init });
    if (url.startsWith(EBAY_OAUTH_ENDPOINT)) {
      return Promise.resolve(json({ access_token: 'app-token-xyz', expires_in: 7200, token_type: 'Application Access Token' }, tokenStatus));
    }
    return Promise.resolve(json(searchBody, searchStatus));
  });
  return calls;
}

describe('/api/ebay（eBay Browse API）', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => resetEbayTokenCache());
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('client_credentials でアプリ用トークンを取り、Bearer と marketplace を付けて検索し、共通形に正規化する', async () => {
    const calls = mockEbay({
      total: 2,
      itemSummaries: [
        {
          itemId: 'v1|123|0',
          title: 'Sony PlayStation 5 Console',
          price: { value: '449.99', currency: 'USD' },
          image: { imageUrl: 'https://i.ebayimg.com/images/g/abc/s-l225.jpg' },
          itemWebUrl: 'https://www.ebay.com/itm/123',
          condition: 'Used',
          seller: { username: 'seller1' },
          shippingOptions: [{ shippingCost: { value: '0.00', currency: 'USD' } }],
        },
        { itemId: 'v1|bad|0', title: '価格なし', itemWebUrl: 'https://www.ebay.com/itm/bad' },
      ],
    });
    const res = await onEbayRequest({ request: req('?q=PS5&limit=3'), env });
    const text = await res.text();
    expect(res.status).toBe(200);

    const [token, search] = calls;
    expect(token.url.href).toBe(EBAY_OAUTH_ENDPOINT);
    expect(token.init.method).toBe('POST');
    expect(new Headers(token.init.headers).get('authorization')).toBe(`Basic ${btoa('ebay-client-id:ebay-client-secret')}`);
    expect(String(token.init.body)).toContain('grant_type=client_credentials');
    expect(String(token.init.body)).toContain(encodeURIComponent('https://api.ebay.com/oauth/api_scope'));

    expect(search.url.origin + search.url.pathname).toBe(EBAY_SEARCH_ENDPOINT);
    expect(search.url.searchParams.get('q')).toBe('PS5');
    expect(search.url.searchParams.get('limit')).toBe('3');
    const headers = new Headers(search.init.headers);
    expect(headers.get('authorization')).toBe('Bearer app-token-xyz');
    expect(headers.get('x-ebay-c-marketplace-id')).toBe('EBAY_US');

    expect(text).not.toMatch(/app-token-xyz|ebay-client-secret|ebay-client-id/);
    expect(JSON.parse(text).items).toEqual([
      {
        id: 'v1|123|0',
        title: 'Sony PlayStation 5 Console',
        shopName: 'seller1',
        price: 449.99,
        currency: 'USD',
        imageUrl: 'https://i.ebayimg.com/images/g/abc/s-l225.jpg',
        url: 'https://www.ebay.com/itm/123',
        shippingText: '送料無料（米国内）',
        conditionText: 'Used',
      },
    ]);
  });

  it('トークンは有効期限まで使い回し、検索ごとに取り直さない', async () => {
    const calls = mockEbay();
    await onEbayRequest({ request: req('?q=PS5'), env });
    await onEbayRequest({ request: req('?q=Switch'), env });
    expect(calls.filter((c) => c.url.href === EBAY_OAUTH_ENDPOINT)).toHaveLength(1);
  });

  it('検索が 401 ならトークンを捨てて upstream_auth、次回は取り直す', async () => {
    const calls = mockEbay({}, 401);
    const res = await onEbayRequest({ request: req('?q=PS5'), env });
    expect((await res.json()).error).toBe('upstream_auth');
    await onEbayRequest({ request: req('?q=PS5'), env });
    expect(calls.filter((c) => c.url.href === EBAY_OAUTH_ENDPOINT)).toHaveLength(2);
  });

  it('トークン取得の失敗（キー誤り）は upstream_auth、キー未設定は上流へ送らず no_key', async () => {
    mockEbay({}, 200, 401);
    expect((await (await onEbayRequest({ request: req('?q=PS5'), env })).json()).error).toBe('upstream_auth');
    const calls = mockEbay();
    expect((await onEbayRequest({ request: req('?q=PS5'), env: { SERVER_EBAY_CLIENT_ID: 'only-id' } })).status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('0件（itemSummaries なし・total 0）は正常な0件、429 / 5xx / 壊れた応答を分類する', async () => {
    mockEbay({ total: 0 });
    expect(await (await onEbayRequest({ request: req('?q=zzz'), env })).json()).toMatchObject({ status: 'ok', items: [] });
    resetEbayTokenCache();
    mockEbay({}, 429);
    expect((await (await onEbayRequest({ request: req('?q=PS5'), env })).json()).error).toBe('rate_limited');
    resetEbayTokenCache();
    mockEbay({}, 503);
    expect((await (await onEbayRequest({ request: req('?q=PS5'), env })).json()).error).toBe('upstream_error');
    resetEbayTokenCache();
    mockEbay({ unexpected: true });
    expect((await (await onEbayRequest({ request: req('?q=PS5'), env })).json()).error).toBe('invalid_json');
  });

  it('marketplace は設定で変えられ、不正な値は EBAY_US に戻す', async () => {
    const calls = mockEbay();
    await onEbayRequest({ request: req('?q=PS5'), env: { ...env, SERVER_EBAY_MARKETPLACE_ID: 'EBAY_GB' } });
    expect(new Headers(calls[1].init.headers).get('x-ebay-c-marketplace-id')).toBe('EBAY_GB');
    const calls2 = mockEbay();
    await onEbayRequest({ request: req('?q=PS5'), env: { ...env, SERVER_EBAY_MARKETPLACE_ID: 'x\r\nInjected: 1' } });
    expect(new Headers(calls2[0].init.headers).get('x-ebay-c-marketplace-id')).toBe('EBAY_US');
  });

  it('別オリジン 403・POST 405・空の検索語 400', async () => {
    mockEbay();
    expect((await onEbayRequest({ request: req('?q=PS5', { headers: { origin: 'https://evil.example' } }), env })).status).toBe(403);
    expect((await onEbayRequest({ request: req('?q=PS5', { method: 'POST' }), env })).status).toBe(405);
    expect((await onEbayRequest({ request: req('?q=%20'), env })).status).toBe(400);
  });
});
