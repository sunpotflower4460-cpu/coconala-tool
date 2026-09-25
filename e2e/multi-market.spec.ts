import { test, expect, type Page } from '@playwright/test';
import { comparedCards, resultCards, search, selectDataSource } from './helpers';

/**
 * まとめて検索（楽天・Yahoo!ショッピング・eBay）と相場一覧の動的監査。
 * ブラウザ → 実 Worker（/api/rakuten・/api/yahoo・/api/ebay）→ 偽の公式API（e2e/fake-rakuten）の経路で確認する。
 */
test.skip(Boolean(process.env.E2E_BASE_URL), 'ローカルの偽APIが必要なため、デプロイ後確認では実行しない');

const FAKE = 'http://127.0.0.1:43174';

async function multiSearch(page: Page, query: string) {
  await page.goto('/');
  await selectDataSource(page, 'multi');
  await search(page, query);
}

const overviewRow = (page: Page, label: string) =>
  page.getByRole('list', { name: 'サイト別の価格帯' }).getByRole('listitem').filter({ has: page.getByText(label, { exact: true }) });

test('3サイトを同時に検索して1つの一覧に並べ、サイト別の件数・絞り込み・安い順（円換算）ができる', async ({ page }) => {
  const api: string[] = [];
  page.on('response', async (r) => {
    if (/\/api\/(rakuten|yahoo|ebay)/.test(r.url())) api.push(await r.text());
  });
  await multiSearch(page, 'E2Eまとめ');

  await expect(page.getByText('実データ表示中 — 楽天・Yahoo!・eBay')).toBeVisible();
  await expect(resultCards(page)).toHaveCount(9);
  const filters = page.getByRole('group', { name: 'サイトで絞り込む' });
  await expect(filters.getByRole('button', { name: /楽天市場\s*3件/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /Yahoo!ショッピング\s*3件/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /eBay\s*3件/ })).toBeVisible();

  // 先頭は各サイトが交互に並ぶ（どのサイトも上の方に見える）
  await expect(resultCards(page).nth(0)).toContainText('【E2E実データ】');
  await expect(resultCards(page).nth(1)).toContainText('【E2E Yahoo】');
  await expect(resultCards(page).nth(2)).toContainText('[E2E eBay]');
  await expect(resultCards(page).nth(2).getByText('$60.00')).toBeVisible();

  await filters.getByRole('button', { name: /eBay/ }).click();
  await expect(resultCards(page)).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) await expect(resultCards(page).nth(i)).toContainText('[E2E eBay]');
  await filters.getByRole('button', { name: /すべて/ }).click();

  await page.getByLabel('並べ替え').selectOption('price_asc');
  // Yahoo ¥9,000 < eBay $60×155=¥9,300 < 楽天 ¥10,000
  await expect(resultCards(page).nth(0)).toContainText('¥9,000');
  await expect(resultCards(page).nth(1)).toContainText('$60.00');
  await expect(resultCards(page).nth(2)).toContainText('¥10,000');

  // どの応答にもキー・トークンが含まれない
  expect(api.join('\n')).not.toMatch(/e2e-dummy|e2e-ebay-app-token/);
  const upstream = (await (await page.request.get(`${FAKE}/__requests`)).json()) as Array<Record<string, string | null>>;
  expect(upstream.find((r) => r.source === 'yahoo' && r.keyword === 'E2Eまとめ')).toMatchObject({ appid: 'e2e-dummy-yahoo-client' });
  expect(upstream.find((r) => r.source === 'ebay' && r.keyword === 'E2Eまとめ')).toMatchObject({
    authorization: 'Bearer e2e-ebay-app-token',
    marketplace: 'EBAY_US',
  });
});

test('相場一覧: 自動取得3サイトの価格帯と最安を表示し、メルカリで見た価格を入れると同じ目盛りで並ぶ', async ({ page }) => {
  await multiSearch(page, 'E2E相場');
  const board = page.getByRole('region', { name: '相場一覧（サイト別の価格帯）' });
  await expect(board).toBeVisible();
  await expect(overviewRow(page, '楽天市場')).toContainText('¥10,000 〜 ¥13,000');
  await expect(overviewRow(page, 'Yahoo!ショッピング')).toContainText('¥9,000 〜 ¥13,000');
  await expect(overviewRow(page, 'eBay')).toContainText('¥9,300 〜 ¥15,500');
  await expect(overviewRow(page, 'Yahoo!ショッピング').getByText('最安')).toBeVisible();

  const mercari = overviewRow(page, 'メルカリ');
  await expect(mercari.getByRole('link', { name: '開く' })).toHaveAttribute('href', /jp\.mercari\.com\/search\?keyword=E2E/);
  await mercari.getByLabel('メルカリで見た価格（円）').fill('８，０００');
  await mercari.getByRole('button', { name: 'メルカリの価格を追加' }).click();
  await expect(mercari).toContainText('¥8,000');
  await expect(mercari.getByText('最安')).toBeVisible();
  await expect(overviewRow(page, 'Yahoo!ショッピング').getByText('最安')).toHaveCount(0);

  // 入力した価格は手動カードとしても一覧に入り、比較に追加できる
  const observed = resultCards(page).filter({ hasText: 'メルカリで確認した価格' });
  await expect(observed.getByText('手動追加')).toBeVisible();
  await observed.getByRole('button', { name: '比較に追加' }).click();
  await expect(comparedCards(page).first()).toContainText('¥8,000');

  await mercari.getByRole('button', { name: /¥8,000 を削除/ }).click();
  await expect(mercari).not.toContainText('¥8,000');
  await expect(overviewRow(page, 'Yahoo!ショッピング').getByText('最安')).toBeVisible();
});

test('相場から大きく外れた価格（付属品等）は価格帯から除き、カードに注意を出す。切り替えで含められる', async ({ page }) => {
  await multiSearch(page, '__outlier Switch');
  const yahooRow = overviewRow(page, 'Yahoo!ショッピング');
  await expect(page.getByText(/相場から大きく外れた 1 件.*を価格帯から除いています/)).toBeVisible();
  await expect(yahooRow).toContainText('¥11,000 〜 ¥13,000');
  await expect(page.getByRole('article').filter({ hasText: '¥900' }).getByText('相場より大幅に安い（付属品等の可能性）')).toBeVisible();

  await page.getByRole('button', { name: '含めて表示する' }).click();
  await expect(yahooRow).toContainText('¥900 〜 ¥13,000');
  await expect(yahooRow.getByText('最安')).toBeVisible();
});

test('一部のサイトが失敗しても他のサイトの実データを表示し、失敗したサイトは理由だけ出す（見本データを混ぜない）', async ({ page }) => {
  await multiSearch(page, '__yahoofail PS5');
  await expect(page.getByRole('status').filter({ hasText: 'Yahoo!ショッピング: 想定外の応答がありました' })).toBeVisible();
  await expect(page.getByText('実データ表示中 — 楽天・Yahoo!・eBay')).toBeVisible();
  const filters = page.getByRole('group', { name: 'サイトで絞り込む' });
  await expect(filters.getByRole('button', { name: /Yahoo!ショッピング\s*未表示/ })).toBeVisible();
  await expect(resultCards(page)).toHaveCount(6);
  await expect(page.getByRole('article').filter({ hasText: '見本データ' })).toHaveCount(0);
  await expect(overviewRow(page, 'Yahoo!ショッピング')).toContainText('想定外の応答がありました');

  await multiSearch(page, '__ebayauth PS5');
  await expect(page.getByRole('status').filter({ hasText: 'eBay: キーまたは許可サイトの設定を確認してください' })).toBeVisible();
  await expect(resultCards(page)).toHaveCount(6);
});

test('3サイトとも接続できないときは理由を表示して見本データ扱いにする', async ({ page }) => {
  await multiSearch(page, '__allfail PS5');
  await expect(page.getByText(/どれにも接続できなかったため、見本データ/)).toBeVisible();
  await expect(page.getByText('デモ表示中 — サンプル/見本データ').first()).toBeVisible();
  await expect(page.getByText(/実データ表示中/)).toHaveCount(0);
});

test('まとめて開く: チェックしたサイトを別ウィンドウで格子状に開く', async ({ page, context }) => {
  // 外部サイトへは実際に通信しない
  await context.route(/^https:\/\/(jp\.mercari\.com|auctions\.yahoo\.co\.jp|fril\.jp|www\.amazon\.co\.jp|www\.google\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>' }),
  );
  await multiSearch(page, 'PS5');
  await expect(page.getByRole('button', { name: /まとめて開く（画面分割・4サイト）/ })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Google 検索 をまとめて開く対象にする' }).check();
  await expect(page.getByRole('button', { name: /まとめて開く（画面分割・5サイト）/ })).toBeVisible();

  const opened: string[] = [];
  context.on('page', (p) => opened.push(p.url()));
  await page.getByRole('button', { name: /まとめて開く/ }).click();
  await expect.poll(() => context.pages().length, { timeout: 10_000 }).toBe(6);
  const urls = context.pages().slice(1).map((p) => p.url()).join('\n');
  for (const host of ['jp.mercari.com', 'auctions.yahoo.co.jp', 'fril.jp', 'www.amazon.co.jp', 'www.google.com']) {
    expect(urls).toContain(host);
  }
});

test('楽天・Yahoo! JAPAN のクレジット表記を画面下部に表示する', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Supported by Rakuten Developers' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Webサービス by Yahoo! JAPAN' })).toHaveAttribute('href', 'https://developer.yahoo.co.jp/sitemap/');
});
