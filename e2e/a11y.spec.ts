import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resultCards, search } from './helpers';

/**
 * アクセシビリティ自動監査（axe-core, WCAG 2.1 A/AA）。4テーマ × 全端末プロジェクトで実行する。
 * 重大（serious / critical）な違反が1件でもあれば失敗にする。
 */
const THEMES = ['Simple Pro', 'Soft Market', 'Dark Trader', 'Natural Board'] as const;

async function auditSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const theme of THEMES) {
  test(`axe: テーマ「${theme}」で検索・比較後の画面に重大なアクセシビリティ違反がない`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: `テーマ: ${theme}` }).click();
    await search(page, 'PS5');
    await resultCards(page).first().getByRole('button', { name: '比較に追加' }).click();
    // アニメーション中のコントラスト誤判定を避ける
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await auditSeriousViolations(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`axe: OS の「透明度を下げる」設定でも、テーマ「${theme}」に重大な違反がない`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '設定の再現に Chromium の開発者用の機能を使う');
    // Mac・Windows の「透明度を下げる」設定の利用者は、半透明のパネルが不透明な暗い色になる（styles.css）
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-transparency', value: 'reduce' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    });
    await page.goto('/');
    await page.getByRole('button', { name: `テーマ: ${theme}` }).click();
    await search(page, 'PS5');
    await resultCards(page).first().getByRole('button', { name: '比較に追加' }).click();
    expect(await auditSeriousViolations(page)).toEqual([]);
  });
}

test('axe: 手動追加ダイアログとエラー表示に重大なアクセシビリティ違反がない', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'URLから手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  await dialog.getByRole('textbox', { name: /^URL/ }).fill('abc');
  await dialog.getByRole('textbox', { name: /^URL/ }).blur();
  await expect(dialog.getByRole('alert')).toBeVisible();
  // 送信ボタンは無効→有効でフェードする。途中の半透明状態を測らないよう、表示が確定してから監査する
  await expect(dialog.getByRole('button', { name: '比較に追加' })).toHaveCSS('opacity', '1');
  expect(await auditSeriousViolations(page)).toEqual([]);
});

test('キーボードだけで検索→比較追加→手動追加ダイアログの開閉ができ、フォーカスが見える', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit は既定で Tab がリンク・ボタンへ移動しない（OS設定依存）ため Chromium で確認');
  await page.goto('/');
  await page.getByLabel('商品名・型番・JAN・URL').focus();
  await page.keyboard.type('PS5');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /^検索結果/ })).toBeVisible();

  const addButton = resultCards(page).first().getByRole('button', { name: '比較に追加' });
  await addButton.focus();
  const outline = await addButton.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();

  await page.getByRole('button', { name: '手動で追加' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  await expect(dialog.getByRole('textbox', { name: /^URL/ })).toBeFocused();
  // Tab はダイアログの外へ出ない
  for (let i = 0; i < 15; i += 1) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '手動で追加' })).toBeFocused();
});

test('「動きを減らす」「透明度を下げる」設定でアニメーション・透過が止まる', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page.locator('.aurora-orb').first().evaluate((el) => getComputedStyle(el).animationDuration);
  expect(['0s', '1e-05s', '0.00001s', '0.01ms']).toContain(duration);

  test.skip(browserName !== 'chromium', 'prefers-reduced-transparency のエミュレーションは Chromium のみ');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  const backdrop = await page.locator('header .glass-header').evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(backdrop === 'none' || backdrop === '').toBeTruthy();
});
