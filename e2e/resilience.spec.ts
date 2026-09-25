import { test, expect } from '@playwright/test';
import { comparedCards, resultCards, search } from './helpers';

/** 外部要因・ブラウザ設定による故障の注入テスト（PRODUCTION_FAILURE_RISK_MATRIX の DATA / EXT 系）。 */

test('DATA-02: localStorage が使えないブラウザでも起動・検索・比較・利益計算ができる', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();
  await search(page, 'PS5');
  await resultCards(page).filter({ hasText: '¥' }).first().getByRole('button', { name: '比較に追加' }).click();
  await comparedCards(page).first().getByRole('button', { name: 'この価格を販売に使う' }).click();
  await expect(page.getByText(/利益見込み/).first()).toBeVisible();
  await expect(page.getByText('表示中に問題が起きました')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('DATA-03: 保存容量がいっぱいのとき履歴保存の失敗を知らせ、一覧を壊さない', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'coconala-tool-history' && value.includes('容量超過テスト')) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await search(page, 'PS5');
  await page.getByLabel('保存名').fill('容量超過テスト');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/履歴の保存に失敗しました/)).toBeVisible();
  await expect(page.getByRole('button', { name: '履歴「容量超過テスト」を再開' })).toHaveCount(0);

  // 失敗後も通常の保存はできる
  await page.getByLabel('保存名').fill('通常の保存');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '履歴「通常の保存」を再開' })).toBeVisible();
});

test('EXT-08: 商品画像が 403 / 読めない場合は NO IMAGE を表示してレイアウトを崩さない', async ({ page }) => {
  await page.route(/placehold\.co|thumbnail\.image\.rakuten|item-shopping\.c\.yimg\.jp|i\.ebayimg\.com/, (route) => route.fulfill({ status: 403, body: '' }));
  await page.goto('/');
  await search(page, 'PS5');
  await expect(resultCards(page).first().getByText('NO IMAGE')).toBeVisible();
  const imagesShown = await resultCards(page).locator('img').count();
  expect(imagesShown).toBe(0);
});

test('EXT-10: Google Fonts に接続できなくても主要フローが動く', async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto('/');
  await search(page, 'PS5');
  await resultCards(page).first().getByRole('button', { name: '比較に追加' }).click();
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();
});

test('USER-10: 200文字の長いタイトルでもカード・比較ボードが画面からはみ出さない', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'URLから手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  await dialog.getByRole('textbox', { name: /^URL/ }).fill('https://jp.mercari.com/item/m_long');
  await dialog.getByLabel('タイトル（任意）').fill('長'.repeat(120) + 'W'.repeat(80));
  await dialog.getByRole('button', { name: '比較に追加' }).click();
  const card = comparedCards(page).first();
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x + box.width <= viewport.width + 1).toBeTruthy();
});
