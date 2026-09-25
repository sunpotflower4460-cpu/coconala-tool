import { test, expect, type Page } from '@playwright/test';
import { comparedCards, downloadCsv, parseCsv, resultCards, search, selectDataSource } from './helpers';

/**
 * 楽天市場モードの動的監査。
 * ブラウザ → /api/rakuten（本番と同じ Worker を workerd で実行）→ 偽の楽天API（e2e/fake-rakuten）の経路で、
 * 実データ表示と各種障害時の表示（理由と貼り付けの案内だけで、偽の商品は出さない）を確認する。
 * デプロイ後（E2E_BASE_URL 指定時）は偽楽天APIが無いため、このファイルは実行しない。
 */
test.skip(Boolean(process.env.E2E_BASE_URL), 'ローカルの偽楽天APIが必要なため、デプロイ後確認では実行しない');

const FAKE = 'http://127.0.0.1:43174';

async function rakutenSearch(page: Page, query: string) {
  await page.goto('/');
  await selectDataSource(page, 'rakuten_mock');
  await expect(page.getByText('楽天市場 — 検索すると接続します')).toBeVisible();
  await search(page, query);
}

async function lastUpstreamRequest(page: Page) {
  const res = await page.request.get(`${FAKE}/__requests`);
  const all = (await res.json()) as Array<Record<string, string | null>>;
  return all;
}

test('実データ: Worker 経由で楽天の商品が「楽天市場の実データ」として並び、キーは画面に出ない', async ({ page }) => {
  const apiResponses: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/api/rakuten')) apiResponses.push(await response.text());
  });

  await rakutenSearch(page, 'E2E実データ確認');

  await expect(page.getByText('実データ表示中 — 楽天市場')).toBeVisible();
  await expect(page.getByText(/自動取得できませんでした/)).toHaveCount(0);
  await expect(resultCards(page)).toHaveCount(3);
  const card = resultCards(page).first();
  await expect(card).toContainText('【E2E実データ】E2E実データ確認 商品1');
  await expect(card.getByText('公式API取得')).toBeVisible();
  await expect(card.getByText(/サンプルデータ|見本データ/)).toHaveCount(0);
  await expect(card.getByText('¥10,000')).toBeVisible();
  await expect(card.getByText('送料込み')).toBeVisible();
  await expect(card.getByRole('link', { name: '元ページを見る' })).toHaveAttribute(
    'href',
    'https://item.rakuten.co.jp/e2e-shop/item-1/',
  );

  // 上流にはアプリID・アクセスキー・Origin が届き、ブラウザ側の応答にはキーが含まれない
  const upstream = (await lastUpstreamRequest(page)).filter((r) => r.keyword === 'E2E実データ確認');
  expect(upstream.at(-1)).toMatchObject({
    applicationId: 'e2e-dummy-app-id',
    accessKey: 'e2e-dummy-access-key',
    hits: '8',
    formatVersion: '2',
  });
  expect(upstream.at(-1)?.origin).toMatch(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/);
  expect(apiResponses.join('\n')).not.toContain('e2e-dummy');
  expect(await page.content()).not.toContain('e2e-dummy');

  // CSV と履歴にも「実データ」「楽天市場の実データ」として残る
  await card.getByRole('button', { name: '比較に追加' }).click();
  await expect(comparedCards(page).first().getByText('公式API取得')).toBeVisible();
  const { text } = await downloadCsv(page);
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  expect(rows[1][2]).toBe('実データ');
  expect(rows[1][3]).toBe('公式API取得');
  expect(rows.find((r) => r[0] === '検索状態')?.[1]).toBe('実データ（公式API）');
  expect(rows.find((r) => r[0] === 'データソース')?.[1]).toBe('楽天市場のみ');
});

const fallbackCases: Array<{ query: string; status: string; message: RegExp }> = [
  { query: '__429 PS5', status: '取得できず（アクセス集中）', message: /検索が集中しました/ },
  { query: '__500 PS5', status: '取得できず（接続先の一時的な不具合）', message: /想定外の応答/ },
  { query: '__503 PS5', status: '取得できず（接続先の一時的な不具合）', message: /想定外の応答/ },
  { query: '__401 PS5', status: '取得できず（連携の設定を確認）', message: /アプリID・アクセスキー・許可サイト/ },
  { query: '__403 PS5', status: '取得できず（連携の設定を確認）', message: /アプリID・アクセスキー・許可サイト/ },
  { query: '__400app PS5', status: '取得できず（連携の設定を確認）', message: /アプリID・アクセスキー・許可サイト/ },
  { query: '__html PS5', status: '取得できず（接続先の一時的な不具合）', message: /想定外の応答/ },
  { query: '__badjson PS5', status: '取得できず（接続先の一時的な不具合）', message: /想定外の応答/ },
  { query: '__big PS5', status: '取得できず（接続先の一時的な不具合）', message: /想定外の応答/ },
  { query: '__error200 PS5', status: '取得できず（接続先の一時的な不具合）', message: /想定外の応答/ },
];

for (const { query, status, message } of fallbackCases) {
  test(`障害: ${query.split(' ')[0]} は理由と貼り付けの案内だけを表示し、偽の商品は出さない`, async ({ page }) => {
    await rakutenSearch(page, query);
    await expect(page.getByRole('status').filter({ hasText: message })).toBeVisible();
    await expect(page.getByText('自動取得できませんでした — 貼り付け・手入力で比較')).toBeVisible();
    await expect(page.getByText(/実データ表示中/)).toHaveCount(0);
    await expect(resultCards(page)).toHaveCount(0);
    await expect(page.getByText(/ページをコピーして貼り付けると価格を並べられます/).first()).toBeVisible();
    await expect(page.getByText(`直近の検索結果: ${status}`)).toBeVisible();
  });
}

test('キー未設定: 偽の商品は出さず、理由と貼り付けの案内を出す。貼り付け・手入力の比較はそのまま使える', async ({ page }) => {
  // 公開直後でキー未設定の Worker を再現（503 no_key）
  await page.route('**/api/rakuten**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], source: 'official_api', status: 'error', error: 'no_key', requestId: 'x' }),
    }),
  );
  await rakutenSearch(page, 'PS5');
  await expect(page.getByText(/楽天市場との連携がまだ設定されていないため/)).toBeVisible();
  await expect(resultCards(page)).toHaveCount(0);
  await expect(page.getByText(/見本データ|サンプルデータ/)).toHaveCount(0);
  await expect(page.getByText('直近の検索結果: 取得できず（連携の設定前）')).toBeVisible();
  await expect(page.getByRole('button', { name: '手動で追加' })).toBeVisible();
});

test('Worker 不在（静的ホスティングで /api が HTML の 404）でも落ちず、設定前として案内する', async ({ page }) => {
  await page.route('**/api/rakuten**', (route) =>
    route.fulfill({ status: 404, contentType: 'text/html', body: '<!doctype html><title>404</title>' }),
  );
  await rakutenSearch(page, 'PS5');
  await expect(page.getByText(/楽天市場との連携がまだ設定されていないため/)).toBeVisible();
  await expect(resultCards(page)).toHaveCount(0);
});

test('障害: 楽天の応答が遅い（8秒超）とタイムアウトとして理由を表示する', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await selectDataSource(page, 'rakuten_mock');
  await page.getByLabel('商品名・型番・JAN・URL').fill('__slow PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('button', { name: '検索中…' })).toBeDisabled();
  await expect(page.getByText(/楽天市場からの応答が遅いため/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('直近の検索結果: 取得できず（応答待ちが長すぎた）')).toBeVisible();
});

test('0件: 楽天が 0件 / 404 を返しても通信失敗扱いせず、実データの0件として案内する', async ({ page }) => {
  for (const query of ['__empty 該当なし', '__404 該当なし']) {
    await rakutenSearch(page, query);
    await expect(page.getByText('実データ表示中 — 楽天市場')).toBeVisible();
    await expect(page.getByText(/楽天市場で該当する商品が見つかりませんでした/)).toBeVisible();
    await expect(resultCards(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /取得できず|貼り付けると/ })).toHaveCount(0);
    await expect(page.getByText('直近の検索結果: 実データ（0件）')).toBeVisible();
  }
});

test('検索語エラー: 楽天が受け付けない語は、検索語の直し方を案内する', async ({ page }) => {
  await rakutenSearch(page, '__400key 検索語');
  await expect(page.getByText(/楽天市場ではこの検索語を使えません/)).toBeVisible();
  await expect(resultCards(page)).toHaveCount(0);

  // 1文字の英字はブラウザ側で止め、楽天へは送らない
  await page.getByLabel('商品名・型番・JAN・URL').fill('a');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/楽天市場ではこの検索語を使えません/)).toBeVisible();
  // 並列実行中の他テストの記録と混ざらないよう、検索語で絞って確認する
  expect((await lastUpstreamRequest(page)).filter((r) => r.keyword === 'a')).toEqual([]);
});

test('オフライン: 通信できないときは理由を表示する（偽の商品は出さない）', async ({ page, context }) => {
  await page.goto('/');
  await selectDataSource(page, 'rakuten_mock');
  await context.setOffline(true);
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/楽天市場に接続できませんでした/)).toBeVisible();
  await expect(resultCards(page)).toHaveCount(0);
  await context.setOffline(false);
});

