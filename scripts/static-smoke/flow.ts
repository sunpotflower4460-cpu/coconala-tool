import { expect, type Page } from '@playwright/test';

/**
 * 静的版（自動取得なし）の基本の流れ:
 * 検索しても偽の商品は出さず理由を表示 → メルカリで見た価格を入れる → 比較 → 利益 → CSV。
 */
export async function runStaticFlow(page: Page, startSearch: () => Promise<void>) {
  await startSearch();
  await expect(page.getByRole('heading', { name: /^検索結果 \(0件\)$/ })).toBeVisible();
  await expect(page.getByText('この版は自動取得なし — 貼り付け・手入力で比較')).toBeVisible();
  await expect(page.getByText(/自動取得をしません/).first()).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText(/見本データ|サンプルデータ|デモ表示中/)).toHaveCount(0);

  const mercari = page
    .getByRole('list', { name: 'サイト別の価格帯' })
    .getByRole('listitem')
    .filter({ has: page.getByText('メルカリ', { exact: true }) });
  await mercari.getByLabel('メルカリで見た価格（円）').fill('12000');
  await mercari.getByRole('button', { name: 'メルカリの価格を追加' }).click();
  await expect(mercari).toContainText('¥12,000');

  await page.getByRole('article').filter({ hasText: 'メルカリで確認した価格' }).getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('200000');
  await expect(page.getByText(/^\+[\d,]+/).first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '比較中カードをCSV出力' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
}
