import { _electron as electron, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test';

/**
 * 出品素材・マニュアルの撮影用に、デスクトップアプリ（dist-desktop/）を偽サーバー（127.0.0.1:43174）につないで起動する。
 * 商品・店舗・右側のサイトのページは説明用の架空のもの（検索語「ワイヤレスイヤホン」で出る）。
 */
const FAKE = 'http://127.0.0.1:43174';
export const DEMO_QUERY = 'ワイヤレスイヤホン';

export async function launchDesktop(userData: string, options: { recordVideoDir?: string } = {}): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['dist-desktop'],
    ...(options.recordVideoDir ? { recordVideo: { dir: options.recordVideoDir, size: { width: 1440, height: 900 } } } : {}),
    env: {
      ...process.env,
      E2E_FAKE_UPSTREAM: '1',
      E2E_PLAIN_KEYSTORE: '1',
      E2E_USER_DATA: userData,
      RAKUTEN_API_BASE_OVERRIDE: `${FAKE}/ichibams/api/IchibaItem/Search/20260701`,
      YAHOO_API_BASE_OVERRIDE: `${FAKE}/ShoppingWebService/V3/itemSearch`,
      EBAY_API_BASE_OVERRIDE: `${FAKE}/buy/browse/v1/item_summary/search`,
      EBAY_OAUTH_URL_OVERRIDE: `${FAKE}/identity/v1/oauth2/token`,
      E2E_SITE_BASE: `${FAKE}/fake-sites`,
      E2E_IMAGE_BASE: FAKE,
    },
  });
  await app.evaluate(({ shell }) => {
    shell.openExternal = async () => undefined;
  });
  const page = await app.firstWindow();
  await page.waitForURL(/^app:\/\/bundle\//);
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return { app, page };
}

/** 右のタブに表示中の実ページ（別レイヤー）を画像にして、画面写真に重ねて写るようにする。 */
export async function withSitePage(app: ElectronApplication, page: Page, fn: () => Promise<void>) {
  const png = await app.evaluate(async ({ BrowserWindow }) => {
    const views = BrowserWindow.getAllWindows()[0].contentView.children as unknown as Array<{
      getVisible(): boolean;
      webContents?: { capturePage(): Promise<{ toDataURL(): string }> };
    }>;
    const visible = views.find((v) => v.webContents && v.getVisible());
    return visible?.webContents ? (await visible.webContents.capturePage()).toDataURL() : null;
  });
  if (png) {
    await page.evaluate((src) => {
      const frame = document.querySelector('[data-testid="site-frame"]');
      const img = document.createElement('img');
      img.id = '__site-shot';
      img.src = src;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;z-index:5';
      frame?.appendChild(img);
    }, png);
    await page.locator('#__site-shot').evaluate((img: HTMLImageElement) => img.decode());
  }
  try {
    await fn();
  } finally {
    await page.evaluate(() => document.getElementById('__site-shot')?.remove());
  }
}

/** 画面写真に ①②③… の番号札を付ける（説明文の番号と対応させる）。 */
export async function withMarks(page: Page, marks: Array<[Locator, number]>, fn: () => Promise<void>) {
  const boxes = [];
  for (const [locator, n] of marks) {
    const box = await locator.first().boundingBox();
    if (box) boxes.push({ ...box, n });
  }
  await page.evaluate((items) => {
    for (const b of items) {
      const ring = document.createElement('div');
      ring.className = '__mark';
      ring.style.cssText = `position:fixed;left:${b.x - 3}px;top:${b.y - 3}px;width:${b.width + 6}px;height:${b.height + 6}px;border:3px solid #ef4444;border-radius:10px;z-index:99998;pointer-events:none`;
      document.body.appendChild(ring);
      const el = document.createElement('div');
      el.className = '__mark';
      el.textContent = String(b.n);
      el.style.cssText = `position:fixed;left:${Math.max(2, b.x - 14)}px;top:${Math.max(2, b.y - 14)}px;width:30px;height:30px;border-radius:50%;background:#ef4444;color:#fff;font:700 17px/30px sans-serif;text-align:center;z-index:99999;box-shadow:0 0 0 3px #fff`;
      document.body.appendChild(el);
    }
  }, boxes);
  try {
    await fn();
  } finally {
    await page.evaluate(() => document.querySelectorAll('.__mark').forEach((el) => el.remove()));
  }
}

