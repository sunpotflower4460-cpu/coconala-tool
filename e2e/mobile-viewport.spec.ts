import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test('幅375pxで横スクロールが発生しない（検索前・検索後とも）', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  const noHorizontalOverflow = async () => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px の丸め誤差は許容
  };

  await noHorizontalOverflow();

  await page.getByLabel('商品名・型番・JAN・URL').fill('PS5');
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByText(/検索結果 \(\d+件\)/)).toBeVisible();

  await noHorizontalOverflow();
});
