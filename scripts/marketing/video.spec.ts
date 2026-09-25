import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_QUERY, launchDesktop } from './desktopApp';

/**
 * 操作動画の下書き（デスクトップアプリ）: 探す → 値段を取り込む → 比較 → 利益。
 * 右側の実ページは別レイヤーのため動画には写らないので、動画では「比較・利益」タブを表示する。
 */
const OUT = path.resolve(process.cwd(), 'dist-delivery', 'marketing');

test('操作動画: 探す → 値段を取り込む → 比較 → 利益（下書き）', async () => {
  test.setTimeout(180_000);
  const userData = mkdtempSync(path.join(os.tmpdir(), 'soba-video-'));
  const videoDir = mkdtempSync(path.join(os.tmpdir(), 'soba-video-out-'));
  const { app, page } = await launchDesktop(userData, { recordVideoDir: videoDir });
  const slow = () => page.waitForTimeout(700);
  try {
    await page.evaluate(() => window.desktop?.keys.save({ rakuten: { appId: 'e2e-app', accessKey: 'e2e-key' }, yahoo: { clientId: 'e2e-yahoo' } }));
    const dialog = page.getByRole('dialog', { name: /設定/ });
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'あとで設定する' }).click();
    await page.getByRole('tab', { name: '比較・利益' }).click();
    await slow();
    await page.getByLabel('商品名・型番・JAN・URL').pressSequentially(DEMO_QUERY, { delay: 120 });
    await page.getByRole('button', { name: 'まとめて探す' }).click();
    await expect(page.getByRole('button', { name: /値段を取り込む/ })).toBeEnabled();
    await slow();
    await page.getByRole('button', { name: /値段を取り込む/ }).click();
    await expect(page.getByText('値段を取り込みました')).toBeVisible();
    await slow();
    const cards = page.getByRole('article');
    await cards.nth(1).getByRole('button', { name: '比較に追加' }).click();
    await slow();
    await cards.nth(3).getByRole('button', { name: '比較に追加' }).click();
    await slow();
    await page.getByRole('button', { name: 'この価格を仕入れに使う' }).first().click();
    await slow();
    await page.getByRole('textbox', { name: '販売価格 (円)' }).pressSequentially('14800', { delay: 120 });
    await page.waitForTimeout(1500);
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
  const [video] = (await fs.readdir(videoDir)).filter((f) => f.endsWith('.webm'));
  if (video) await fs.copyFile(path.join(videoDir, video), path.join(OUT, 'walkthrough-draft.webm'));
  rmSync(videoDir, { recursive: true, force: true });
});
