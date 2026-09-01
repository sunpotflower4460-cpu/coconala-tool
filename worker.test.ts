import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './worker';

function makeRequest(path: string, method = 'GET') {
  return new Request(`https://example.pages.dev${path}`, { method });
}

describe('Cloudflare Worker entry', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GET /api/rakuten を既存 Pages Function に渡し、キー未設定なら no_key を返す', async () => {
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

  it('SERVER_RAKUTEN_APP_ID を env 経由で渡し、レスポンスにキーを含めない', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ Items: [] }),
      } as Response);
    });
    const res = await worker.fetch(makeRequest('/api/rakuten?q=PS5'), {
      SERVER_RAKUTEN_APP_ID: 'super-secret-app-id',
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('super-secret-app-id');
    expect(JSON.parse(text)).toMatchObject({ status: 'ok', items: [] });
    expect(new URL(capturedUrl).searchParams.get('applicationId')).toBe('super-secret-app-id');
  });
});
