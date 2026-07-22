import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test('サンプル検索: 検索語でカードが絞り込まれる', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();

  await expect(page.getByText(/検索結果 \(\d+件\)/)).toBeVisible();
  const cardTitles = page.locator('h3');
  const count = await cardTitles.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(cardTitles.nth(i)).toContainText('PS5');
  }
});

test('サンプル検索: 該当なしの場合は0件案内が出る', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('存在しない商品名zzzzz');
  await page.getByRole('button', { name: 'まとめて探す' }).click();

  await expect(page.getByText('該当する候補が見つかりませんでした')).toBeVisible();
});

test('比較追加: カードを比較ボードに追加できる', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/検索結果 \(\d+件\)/)).toBeVisible();

  await page.getByRole('button', { name: '比較に追加' }).first().click();

  await expect(page.getByText('比較ボード (1件)')).toBeVisible();
  await expect(page.getByRole('button', { name: '比較中' }).first()).toBeVisible();
});

test('利益反映: 比較カードの価格を仕入れ/販売価格に反映できる', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await page.getByRole('button', { name: '比較に追加' }).first().click();
  await expect(page.getByText('比較ボード (1件)')).toBeVisible();

  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();

  const buyInput = page.getByRole('spinbutton', { name: /仕入れ価格/ });
  await expect(buyInput).not.toHaveValue('0');
  await expect(page.getByText(/由来:/)).toBeVisible();
});

test('手動追加: タイトル・通貨を指定してカードを追加できる', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/検索結果 \(\d+件\)/)).toBeVisible();

  await page.getByRole('button', { name: '手動で追加' }).click();
  await page.getByLabel('タイトル（任意）').fill('E2Eテスト商品');
  await page.getByLabel('サイト名').fill('メルカリ');
  await page.locator('input[type="url"]').first().fill('https://jp.mercari.com/item/m_e2e_test');
  await page.getByRole('textbox', { name: '価格' }).fill('1234');
  await page.getByLabel('通貨').selectOption('USD');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByText('手動カードを追加しました')).toBeVisible();
  await expect(page.getByText('E2Eテスト商品').first()).toBeVisible();
});

test('CSV出力: 比較ボードにカードがあるとCSVがダウンロードできる', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await page.getByRole('button', { name: '比較に追加' }).first().click();
  await expect(page.getByText('比較ボード (1件)')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '比較中カードをCSV出力' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^research-session-.*\.csv$/);
});

test('リサーチ履歴: 保存して一覧に表示され、再開すると保存時の状態に戻る', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await page.getByRole('button', { name: '比較に追加' }).first().click();
  await expect(page.getByText('比較ボード (1件)')).toBeVisible();

  await page.getByLabel('保存名').fill('E2E保存テスト');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('E2E保存テスト')).toBeVisible();

  // Diverge from the saved state by adding a second card, so that clicking
  // 再開 afterwards can only pass if it actually restores the saved snapshot.
  await page.getByRole('button', { name: '比較に追加' }).nth(1).click();
  await expect(page.getByText('比較ボード (2件)')).toBeVisible();

  await page.getByRole('button', { name: '再開' }).click();
  await expect(page.getByText('比較ボード (1件)')).toBeVisible();
});
