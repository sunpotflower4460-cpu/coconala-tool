import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_QUERY, launchDesktop, withSitePage } from './desktopApp';

/**
 * 出品ページ用の画面写真（デスクトップアプリ・テーマ別）。商品・店舗・右側のページは説明用の架空のもの。
 * 出力: dist-delivery/marketing/
 */
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

test('画面写真: まとめて探す → 値段を取り込む（テーマ別）', async () => {
  test.setTimeout(180_000);
  const userData = mkdtempSync(path.join(os.tmpdir(), 'soba-capture-'));
  const { app, page } = await launchDesktop(userData);
  try {
    await page.evaluate(() => window.desktop?.keys.save({ rakuten: { appId: 'e2e-app', accessKey: 'e2e-key' }, yahoo: { clientId: 'e2e-yahoo' } }));
    const dialog = page.getByRole('dialog', { name: /設定/ });
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'あとで設定する' }).click();
    await page.getByLabel('商品名・型番・JAN・URL').fill(DEMO_QUERY);
    await page.getByRole('button', { name: 'まとめて探す' }).click();
    await expect(page.getByRole('button', { name: /値段を取り込む/ })).toBeEnabled();
    await page.getByRole('button', { name: /値段を取り込む/ }).click();
    await expect(page.getByText('値段を取り込みました')).toBeVisible();
    await page.locator('#desktop-results').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    for (const [id, label] of THEMES) {
      await page.getByRole('button', { name: `テーマ: ${label}` }).click();
      await page.waitForTimeout(300);
      await withSitePage(app, page, () => page.screenshot({ path: path.join(OUT, `screen-${id}.png`) }).then(() => undefined));
    }
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});
