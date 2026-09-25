import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './worker';

function makeRequest(path: string, method = 'GET') {
  return new Request(`https://coconala-tool.example.workers.dev${path}`, { method });
}

describe('Cloudflare Worker entry', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GET /api/rakuten を楽天プロキシに渡し、キー未設定なら no_key を返す', async () => {
    const res = await worker.fetch(makeRequest('/api/rakuten?q=PS5'), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'no_key' });
  });

  it('API 以外のパスは静的アセット側へ任せるため 404 を返す', async () => {
    const res = await worker.fetch(makeRequest('/'), {});
    expect(res.status).toBe(404);
  });

  it('末尾スラッシュ付き /api/rakuten/ も同じハンドラへ渡す', async () => {
    const res = await worker.fetch(makeRequest('/api/rakuten/?q=PS5'), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'no_key' });
  });

  it('パスの大文字 /API/rakuten は API として扱わず 404', async () => {
    const res = await worker.fetch(makeRequest('/API/rakuten?q=PS5'), {});
    expect(res.status).toBe(404);
  });

  it('アプリID・アクセスキーを env 経由で渡し、レスポンスにキーを含めない', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(new Response(JSON.stringify({ Items: [] }), { status: 200 }));
    });
    const res = await worker.fetch(makeRequest('/api/rakuten?q=PS5'), {
      SERVER_RAKUTEN_APP_ID: 'super-secret-app-id',
      SERVER_RAKUTEN_ACCESS_KEY: 'super-secret-access-key',
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('super-secret-app-id');
    expect(text).not.toContain('super-secret-access-key');
    expect(new URL(capturedUrl).searchParams.get('accessKey')).toBe('super-secret-access-key');
    expect(JSON.parse(text)).toMatchObject({ status: 'ok', items: [] });
    expect(new URL(capturedUrl).searchParams.get('applicationId')).toBe('super-secret-app-id');
  });

  it('レート制限を超えたら楽天へ送らず 429 rate_limited（キーは接続元IP）', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const keys: string[] = [];
    const limiter = {
      limit: vi.fn(async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: false };
      }),
    };
    const request = new Request('https://coconala-tool.example.workers.dev/api/rakuten?q=PS5', {
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    });
    const res = await worker.fetch(request, { RAKUTEN_RATE_LIMITER: limiter, SERVER_RAKUTEN_APP_ID: 'a', SERVER_RAKUTEN_ACCESS_KEY: 'b' });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited' });
    expect(keys).toEqual(['203.0.113.9']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('レート制限内なら通常どおり処理し、制限サービス自体の障害でも検索を止めない', async () => {
    const ok = { limit: vi.fn(async () => ({ success: true })) };
    expect((await worker.fetch(makeRequest('/api/rakuten?q=PS5'), { RAKUTEN_RATE_LIMITER: ok })).status).toBe(503);
    const broken = { limit: vi.fn(async () => { throw new Error('binding down'); }) };
    expect((await worker.fetch(makeRequest('/api/rakuten?q=PS5'), { RAKUTEN_RATE_LIMITER: broken })).status).toBe(503);
  });

  it('API 以外（静的アセットに無いパス）はレート制限を消費しない', async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const res = await worker.fetch(makeRequest('/api/other'), { RAKUTEN_RATE_LIMITER: limiter });
    expect(res.status).toBe(404);
    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it('/api/yahoo と /api/ebay もそれぞれのハンドラへ渡し、キー未設定なら no_key（レート制限の枠は共通）', async () => {
    const keys: string[] = [];
    const limiter = { limit: vi.fn(async ({ key }: { key: string }) => (keys.push(key), { success: true })) };
    for (const path of ['/api/yahoo?q=PS5', '/api/ebay?q=PS5', '/api/yahoo/?q=PS5']) {
      const res = await worker.fetch(makeRequest(path), { RAKUTEN_RATE_LIMITER: limiter });
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: 'no_key' });
    }
    expect(limiter.limit).toHaveBeenCalledTimes(3);
  });
});
