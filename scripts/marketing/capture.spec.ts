import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QUERY_LABEL, useManualFixtures } from './manual-fixtures';

const OUT = path.resolve(process.cwd(), 'dist-delivery', 'marketing');
const THEMES = [
  ['simple-pro', 'Simple Pro'],
  ['soft-market', 'Soft Market'],
  ['dark-trader', 'Dark Trader'],
  ['natural-board', 'Natural Board'],
] as const;

test.beforeAll(async () => {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
});

async function prepareBoard(page: Page, mode: 'multi' | 'rakuten_mock', query: string) {
  // 実在しない商品データ（ブラウザ内で /api/* を差し替え）で撮る
  await useManualFixtures(page);
  await page.goto('/');
  await page.getByLabel('データソースを選ぶ').selectOption(mode);
  await page.getByLabel('商品名・型番・JAN・URL').fill(query);
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('heading', { name: /^検索結果 \(\d+件\)$/ })).toBeVisible();
  const cards = page.getByRole('article').filter({ hasText: '¥' });
  await cards.nth(0).getByRole('button', { name: '比較に追加' }).click();
  await cards.nth(1).getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('89800');
  await page.getByRole('textbox', { name: '送料 (円)' }).fill('1200');
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const [id, label] of THEMES) {
  for (const [device, viewport] of [
    ['pc', { width: 1440, height: 900 }],
    ['sp', { width: 390, height: 844 }],
  ] as const) {
    test(`画面写真: ${label} / ${device}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await prepareBoard(page, 'multi', QUERY_LABEL);
      await page.getByRole('button', { name: `テーマ: ${label}` }).click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (device === 'pc') {
        // PC は「検索結果のカード」と「比較ボード・利益」が並ぶ位置を撮る
        await page.getByRole('heading', { name: /^検索結果/ }).evaluate((el) =>
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110),
        );
      }
      await page.screenshot({ path: path.join(OUT, `screen-${id}-${device}.png`), fullPage: device === 'sp' });
    });
  }
}

test('画面写真: 楽天市場のみの表示（実在しない商品データで撮影）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareBoard(page, 'rakuten_mock', QUERY_LABEL);
  await page.getByRole('heading', { name: /^検索結果/ }).evaluate((el) =>
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110),
  );
  await page.screenshot({ path: path.join(OUT, 'screen-rakuten-live-pc.png') });
});

