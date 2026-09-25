import { test, expect } from '@playwright/test';
import { runStaticFlow } from './flow';

test('静的版: 自動取得しないことを明示し（偽の商品は出さない）、入力した価格で比較→利益→CSV が動く', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();
  await runStaticFlow(page, async () => {
    await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
    await page.getByRole('button', { name: 'まとめて探す' }).click();
  });

  await page.getByLabel('データソースを選ぶ').selectOption('rakuten_mock');
  await expect(page.getByText(/この版は楽天市場の自動取得をしません/)).toBeVisible();
  await page.getByLabel('商品名・型番・JAN・URL').fill('ウォークマン');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('status').filter({ hasText: /自動取得をしません/ })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: '公式API取得' })).toHaveCount(0);

  expect(errors).toEqual([]);
});
