import { test, expect } from '@playwright/test';

test('静的版: 検索→比較→利益→CSV が動き、楽天市場は見本データであることを明示する', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();

  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('heading', { name: /^検索結果 \(\d+件\)$/ })).toBeVisible();
  await page.getByRole('article').filter({ hasText: '¥' }).first().getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('200000');
  await expect(page.getByText(/^\+[\d,]+/).first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '比較中カードをCSV出力' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);

  await page.getByLabel('データソースを選ぶ').selectOption('rakuten_mock');
  await expect(page.getByText(/この公開版は楽天市場と連携していないため/)).toBeVisible();
  await page.getByLabel('商品名・型番・JAN・URL').fill('ウォークマン');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/この公開版は楽天市場との連携なしで動作しています/)).toBeVisible();
  await expect(page.getByRole('article').first().getByText('見本データ（実在しない商品）')).toBeVisible();

  expect(errors).toEqual([]);
});
