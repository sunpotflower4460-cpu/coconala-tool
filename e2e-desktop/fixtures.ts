import { _electron as electron, expect, test as base, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import type {} from '../src/lib/desktopBridge';
import os from 'node:os';
import path from 'node:path';

export const FAKE = 'http://127.0.0.1:43175';

export type Launch = (options?: { userData?: string }) => Promise<{ app: ElectronApplication; page: Page; userData: string }>;

/** テストごとに空の保存場所でアプリを起動し、終わったら閉じる。外部ブラウザで開く操作は記録するだけにする。 */
export const test = base.extend<{ launch: Launch }>({
  launch: async ({}, use) => {
    const apps: ElectronApplication[] = [];
    const dirs: string[] = [];
    await use(async ({ userData } = {}) => {
      const dir = userData ?? fs.mkdtempSync(path.join(os.tmpdir(), 'soba-desktop-'));
      if (!userData) dirs.push(dir);
      const app = await electron.launch({
        args: ['dist-desktop'],
        env: {
          ...process.env,
          E2E_FAKE_UPSTREAM: '1',
          E2E_PLAIN_KEYSTORE: '1',
          E2E_USER_DATA: dir,
          RAKUTEN_API_BASE_OVERRIDE: `${FAKE}/ichibams/api/IchibaItem/Search/20260701`,
          YAHOO_API_BASE_OVERRIDE: `${FAKE}/ShoppingWebService/V3/itemSearch`,
          EBAY_API_BASE_OVERRIDE: `${FAKE}/buy/browse/v1/item_summary/search`,
          EBAY_OAUTH_URL_OVERRIDE: `${FAKE}/identity/v1/oauth2/token`,
          E2E_SITE_BASE: `${FAKE}/fake-sites`,
        },
      });
      apps.push(app);
      await app.evaluate(({ shell }) => {
        const opened: string[] = [];
        (globalThis as unknown as { __opened: string[] }).__opened = opened;
        shell.openExternal = async (url: string) => {
          opened.push(url);
        };
      });
      const page = await app.firstWindow();
      await page.waitForURL(/^app:\/\/bundle\//);
      await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();
      return { app, page, userData: dir };
    });
    for (const app of apps) await app.close().catch(() => undefined);
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  },
});

export { expect };

/** 外部ブラウザで開こうとしたURL */
export function openedUrls(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened);
}

/** 右側のタブ（実ページ）の状態: 表示中か・位置・URL */
export function siteViews(app: ElectronApplication) {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children
      .filter((v) => 'webContents' in v)
      .map((v) => {
        const view = v as unknown as { getVisible(): boolean; getBounds(): { x: number; y: number; width: number; height: number }; webContents: { getURL(): string } };
        return { visible: view.getVisible(), bounds: view.getBounds(), url: view.webContents.getURL() };
      }),
  );
}

/** キーを画面を通さずに保存する（キー設定以外のテストの準備用） */
export async function saveTestKeys(page: Page) {
  await page.evaluate(() =>
    window.desktop?.keys.save({ rakuten: { appId: 'e2e-app', accessKey: 'e2e-key' }, yahoo: { clientId: 'e2e-yahoo' } }),
  );
}

export async function closeSetupIfOpen(page: Page) {
  const dialog = page.getByRole('dialog', { name: /設定/ });
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: /あとで設定する|閉じる/ }).first().click();
  await expect(dialog).toHaveCount(0);
}

export async function search(page: Page, query: string) {
  await page.getByLabel('商品名・型番・JAN・URL').fill(query);
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByTestId('result-summary')).toBeVisible();
}
