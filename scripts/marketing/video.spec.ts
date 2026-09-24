import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'dist-delivery', 'marketing');

test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } });

test('操作動画: 検索 → 比較 → 利益 → CSV（下書き）', async ({ page }, testInfo) => {
  const slow = () => page.waitForTimeout(700);
  await page.goto('/');
  await slow();
  await page.getByLabel('商品名・型番・JAN・URL').pressSequentially('PS5', { delay: 150 });
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('heading', { name: /^検索結果/ })).toBeVisible();
  await slow();
  const cards = page.getByRole('article').filter({ hasText: '¥' });
  await cards.nth(0).getByRole('button', { name: '比較に追加' }).click();
  await slow();
  await cards.nth(1).getByRole('button', { name: '比較に追加' }).click();
  await slow();
  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();
  await slow();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).pressSequentially('89800', { delay: 120 });
  await slow();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '比較中カードをCSV出力' }).click();
  await download;
  await page.waitForTimeout(1500);
  await page.close();
  const video = page.video();
  if (video) await fs.copyFile(await video.path(), path.join(OUT, 'walkthrough-draft.webm'));
  testInfo.annotations.push({ type: 'output', description: OUT });
});
