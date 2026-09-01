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
});
