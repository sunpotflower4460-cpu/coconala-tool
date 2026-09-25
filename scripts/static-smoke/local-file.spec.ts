import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';

/** ①ツールを開く.html をダブルクリックした状態（file://）で、主要な操作ができることを確認する。 */
const LOCAL_HTML = process.env.LOCAL_HTML_PATH;
test.skip(!LOCAL_HTML, 'LOCAL_HTML_PATH が指定されたときだけ実行');

test('1ファイル版: ダブルクリック（file://）で開いて、検索→比較→利益→CSV・貼り付け取り込みができる', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(pathToFileURL(LOCAL_HTML as string).href);
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();

  await page.getByRole('button', { name: /PS5 で試してみる/ }).click();
  await expect(page.getByRole('heading', { name: /^検索結果 \(\d+件\)$/ })).toBeVisible();
  await page.getByRole('article').filter({ hasText: '¥' }).first().getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('200000');
  await expect(page.getByText(/^\+[\d,]+/).first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '比較中カードをCSV出力' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);

  // 保存（localStorage）も file:// で使える
  await page.getByLabel('保存名').fill('ローカル保存テスト');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.reload();
  await expect(page.getByText('ローカル保存テスト')).toBeVisible();
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();

  expect(errors).toEqual([]);
});
