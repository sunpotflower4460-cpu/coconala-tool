import { test, expect } from '@playwright/test';
import { comparedCards, expectNoHorizontalOverflow, resultCards, search } from './helpers';

/**
 * 画面幅ごとの見た目・操作性の確認。playwright.config.ts の全プロジェクト
 * （1280 / 768 / 375 の Chromium と iPhone SE の WebKit）で実行される。
 */

test('@postdeploy 横スクロールが出ず、主要フロー（検索→比較→利益→手動追加）を操作できる', async ({ page }) => {
  await page.goto('/');
  await expectNoHorizontalOverflow(page);

  await search(page, 'PS5');
  await expectNoHorizontalOverflow(page);

  await resultCards(page).filter({ hasText: '¥' }).first().getByRole('button', { name: '比較に追加' }).click();
  await comparedCards(page).first().getByRole('button', { name: 'この価格を仕入れに使う' }).click();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('100000');
  await expect(page.getByText(/^\+[\d,]+$/).or(page.getByText(/円$/)).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: '手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  // ダイアログの送信ボタンまでスクロールして押せる（スマホで下が切れない）
  const submit = dialog.getByRole('button', { name: '比較に追加' });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('幅に応じてサイドバーが結果の右（PC）か下（スマホ・タブレット）に並ぶ', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  const results = await page.getByRole('heading', { name: /^検索結果/ }).boundingBox();
  const sidebar = await page.getByRole('heading', { name: /^比較ボード \(/ }).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(results && sidebar).toBeTruthy();
  if (width >= 1024) {
    expect(sidebar!.x).toBeGreaterThan(results!.x + results!.width);
  } else {
    expect(sidebar!.y).toBeGreaterThan(results!.y);
  }
});

test('押せる部品（ボタン・リンク・入力）はタップしやすい 44px 以上の高さがある', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  await resultCards(page).first().getByRole('button', { name: '比較に追加' }).click();
  await page.getByLabel('保存名').fill('タップ確認');
  await page.getByRole('button', { name: '保存', exact: true }).click();

  const small = await page.evaluate(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('main button, main input, main select, main a[href]'),
    )
      // チェックボックスは、押せる範囲である外側のラベルの高さで判定する
      .map((el) => (el instanceof HTMLInputElement && el.type === 'checkbox' && el.closest('label') ? (el.closest('label') as HTMLElement) : el))
      .filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      // 画面外・非表示・文中リンク（フッターのクレジット等）は対象外
      return style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !el.closest('footer');
    });
    return targets
      .filter((el) => el.getBoundingClientRect().height < 43.5)
      .map((el) => `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
  });
  expect(small, 'タップしにくい小さな部品').toEqual([]);
});

test('スクロールしてもヘッダーの表示状態（実データ/取得できず）が読める', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  await page.evaluate(() => window.scrollBy(0, 1500));
  const badge = page.locator('header').getByText(/実データ表示中|自動取得できませんでした/);
  await expect(badge).toBeInViewport();
  const bg = await page.locator('header .glass-header').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
});
