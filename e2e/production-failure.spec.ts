import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test('SEC-04: 履歴の HTML タイトルはテキスト表示され alert されない', async ({ page }) => {
  const alerts: string[] = [];
  page.on('dialog', (dialog) => {
    alerts.push(dialog.message());
    void dialog.dismiss();
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      'coconala-tool-history',
      JSON.stringify({
        state: {
          sessions: [
            {
              id: 'xss-1',
              name: 'XSS履歴',
              query: '<img src=x onerror=alert(1)>',
              resultCards: [
                {
                  id: 'xss-card',
                  title: '<img src=x onerror=alert(1)>',
                  siteName: '<script>alert(1)</script>',
                  sourceType: 'manual',
                  pageUrl: 'https://example.com/item',
                  confidence: 'high',
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              comparedCards: [
                {
                  id: 'xss-card',
                  title: '<img src=x onerror=alert(1)>',
                  siteName: '<script>alert(1)</script>',
                  sourceType: 'manual',
                  pageUrl: 'https://example.com/item',
                  confidence: 'high',
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              profitSettings: {
                buyPrice: 0,
                sellPrice: 0,
                shippingCost: 0,
                feeRate: 10,
                exchangeRate: 155,
              },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              dataSourceMode: 'sample',
              searchStatus: 'official_api',
              searchWarnings: [],
              lastSearchedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        version: 1,
      }),
    );
  });

  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText('XSS履歴')).toBeVisible();
  await page.getByRole('button', { name: '再開' }).click();

  await expect(page.getByText('<img src=x onerror=alert(1)>').first()).toBeVisible();
  await expect(page.getByText('デモ表示中 — サンプル/モックデータ', { exact: true })).toBeVisible();
  await expect(page.getByText(/公式データ取得中/)).toHaveCount(0);
  expect(alerts).toEqual([]);
});

test('CONC-05: 他タブの履歴保存が storage 経由で反映される', async ({ context, page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/検索結果 \(\d+件\)/)).toBeVisible();

  const pageB = await context.newPage();
  await pageB.goto('/');
  await pageB.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await pageB.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(pageB.getByText(/検索結果 \(\d+件\)/)).toBeVisible();

  await page.getByLabel('保存名').fill('タブAの履歴');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('タブAの履歴')).toBeVisible();
  await expect(pageB.getByText('タブAの履歴')).toBeVisible({ timeout: 5_000 });
});

test('USER-07: URL を検索語にしてもアプリは落ちずサンプル検索できる', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('https://jp.mercari.com/search?keyword=PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/該当する候補が見つかりませんでした|検索結果 \(\d+件\)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();
});

test('SEC-05: 検索ショートカットは noopener noreferrer で開く', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  const shortcut = page.getByRole('link', { name: /メルカリ/ }).first();
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(shortcut).toHaveAttribute('target', '_blank');
});
