import { test, expect } from '@playwright/test';
import { resultCards, search } from './helpers';

// 本番と同じ Worker・静的アセット配信の防御を、ローカル（偽楽天API）とデプロイ後（E2E_BASE_URL）の両方で確認する。

test('@postdeploy API 直接呼び出し: メソッド・Origin・パスの防御とセキュリティヘッダー', async ({ request, baseURL }) => {
  const post = await request.post('/api/rakuten?q=PS5');
  expect(post.status()).toBe(405);
  expect(await post.json()).toMatchObject({ error: 'method_not_allowed' });

  const crossOrigin = await request.get('/api/rakuten?q=PS5', { headers: { Origin: 'https://evil.example' } });
  expect(crossOrigin.status()).toBe(403);
  expect(await crossOrigin.json()).toMatchObject({ error: 'forbidden_origin' });

  const sameSite = await request.get('/api/rakuten?q=PS5', { headers: { 'Sec-Fetch-Site': 'same-site' } });
  expect(sameSite.status()).toBe(403);

  const empty = await request.get('/api/rakuten?q=');
  expect(empty.status()).toBe(400);

  const other = await request.get('/api/other');
  expect(other.status()).toBe(404);

  const ok = await request.get('/api/rakuten?q=PS5', { headers: { Origin: new URL(baseURL!).origin } });
  expect(ok.headers()['cache-control']).toBe('no-store');
  expect(ok.headers()['x-content-type-options']).toBe('nosniff');
  expect(ok.headers()['x-frame-options']).toBe('DENY');
  expect(await ok.text()).not.toMatch(/applicationId|accessKey|e2e-dummy/);

  // SPA のディープリンクは index.html を返す
  const deep = await request.get('/some/deep/link');
  expect(deep.status()).toBe(200);
  expect(await deep.text()).toContain('<div id="root"></div>');
});

test('@postdeploy 画面のセキュリティヘッダー（CSP・クリックジャッキング対策）と CSP 違反ゼロ', async ({ page, request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');

  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy|Refused to/.test(msg.text())) violations.push(msg.text());
  });
  await page.goto('/');
  await search(page, 'PS5');
  await resultCards(page).first().getByRole('button', { name: '比較に追加' }).click();
  expect(violations).toEqual([]);
});
