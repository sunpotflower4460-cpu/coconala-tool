import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { runStaticFlow } from './flow';

/** ブラウザ版（自動取得なし）.html をダブルクリックした状態（file://）で、主要な操作ができることを確認する。 */
const LOCAL_HTML = process.env.LOCAL_HTML_PATH;
test.skip(!LOCAL_HTML, 'LOCAL_HTML_PATH が指定されたときだけ実行');

test('1ファイル版: ダブルクリック（file://）で開いて、価格の入力→比較→利益→CSV・保存ができる（偽の商品は出さない）', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(pathToFileURL(LOCAL_HTML as string).href);
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();

  await runStaticFlow(page, () => page.getByRole('button', { name: /Nintendo Switch 2 で試してみる/ }).click());

  // 保存（localStorage）も file:// で使える
  await page.getByLabel('保存名').fill('ローカル保存テスト');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.reload();
  await expect(page.getByText('ローカル保存テスト')).toBeVisible();
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();

  expect(errors).toEqual([]);
});
