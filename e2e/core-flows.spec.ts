import { test, expect } from '@playwright/test';
import { comparedCards, downloadCsv, parseCsv, resultCards, search, SEARCH_INPUT } from './helpers';

// Playwright はテストごとに新しいブラウザコンテキストを使うため、localStorage は毎回空から始まる。

test('@postdeploy 初期表示: 見出し・デモ表示・サイドバー・楽天クレジットが出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '相場カード比較ボード' })).toBeVisible();
  await expect(page.getByText('デモ表示中 — サンプル/見本データ').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'リサーチ履歴' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^比較ボード \(0件\)$/ })).toBeVisible();
  await expect(page.getByText('比較に追加すると、ここで並べて見比べられます')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Supported by Rakuten Developers' })).toHaveAttribute(
    'href',
    'https://developers.rakuten.com/',
  );
});

test('@postdeploy サンプル検索: PS5 で PS5/PlayStation 5 のカードだけが並び、出所ラベルが付く', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  const cards = resultCards(page);
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(/PS5|PlayStation 5/);
    await expect(card.getByText('サンプルデータ')).toBeVisible();
    await expect(card.getByRole('link', { name: '元ページを見る' })).toHaveAttribute('rel', /noopener/);
  }
});

test('サンプル検索: 該当なしでも案内と「手動で追加」が出る', async ({ page }) => {
  await page.goto('/');
  await search(page, '存在しない商品名zzzzz');
  await expect(page.getByText('該当する候補が見つかりませんでした')).toBeVisible();
  await expect(resultCards(page)).toHaveCount(0);
  await page.getByRole('button', { name: '手動で追加' }).click();
  await expect(page.getByRole('dialog', { name: '手動で追加' })).toBeVisible();
});

test('比較追加と削除: 追加→比較中表示→×で外すと空に戻る', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  const firstCard = resultCards(page).first();
  const title = (await firstCard.getByRole('heading', { level: 3 }).textContent()) ?? '';

  await firstCard.getByRole('button', { name: '比較に追加' }).click();
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();
  await expect(firstCard.getByRole('button', { name: '比較中' })).toHaveAttribute('aria-pressed', 'true');
  await expect(comparedCards(page).first()).toContainText(title);
  // 比較ボードでも出所（サンプル / ソース区分）が見える
  await expect(comparedCards(page).first().getByText('サンプルデータ')).toBeVisible();

  await comparedCards(page).first().getByRole('button', { name: '比較から削除' }).click();
  await expect(page.getByRole('heading', { name: '比較ボード (0件)' })).toBeVisible();
  await expect(page.getByText('比較に追加すると、ここで並べて見比べられます')).toBeVisible();
  await expect(firstCard.getByRole('button', { name: '比較に追加' })).toHaveAttribute('aria-pressed', 'false');
});

test('利益計算: カード価格を仕入れ/販売へ反映し、手数料・送料込みの利益が正しく出る', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  // 円建てのカードを使う（ドル建ては為替換算の別テストで確認）
  await resultCards(page).filter({ hasText: '¥' }).first().getByRole('button', { name: '比較に追加' }).click();

  const card = comparedCards(page).first();
  const priceText = (await card.locator('.num').first().textContent()) ?? '';
  const price = Number(priceText.replace(/[^\d]/g, ''));
  expect(price).toBeGreaterThan(0);

  await card.getByRole('button', { name: 'この価格を仕入れに使う' }).click();
  const buyInput = page.getByRole('textbox', { name: '仕入れ価格 (円)' });
  await expect(buyInput).toHaveValue(String(price));
  await expect(page.getByText(/由来:/)).toBeVisible();

  const sell = price + 20000;
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill(String(sell));
  await page.getByRole('textbox', { name: '送料 (円)' }).fill('1,000');
  const fee = Math.floor(sell * 0.1);
  const profit = sell - fee - price - 1000;
  await expect(page.getByText(`= ${profit.toLocaleString('ja-JP')}円`)).toBeVisible();
  await expect(page.getByText(`+${profit.toLocaleString('ja-JP')}`)).toBeVisible();
});

test('利益計算: 赤字になるとメモが赤字を知らせる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '仕入れ価格 (円)' }).fill('12000');
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('10000');
  await expect(page.getByText('赤字の見込みです。', { exact: false })).toBeVisible();
  await expect(page.getByText('利益薄い')).toBeVisible();
});

test('手動追加: 全角・万円表記の価格とUSDを登録し、比較ボードと円換算に反映される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'URLから手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  await expect(dialog.getByRole('textbox', { name: /URL/ }).first()).toBeFocused();

  await dialog.getByRole('textbox', { name: /^URL/ }).fill('https://www.ebay.com/itm/e2e-test');
  await dialog.getByRole('textbox', { name: /^URL/ }).blur();
  await expect(dialog.getByLabel('サイト名')).toHaveValue('eBay');
  await dialog.getByLabel('タイトル（任意）').fill('E2E USD商品');
  await dialog.getByRole('textbox', { name: '価格' }).fill('$１００');
  await dialog.getByLabel('通貨').selectOption('USD');
  await dialog.getByRole('button', { name: '比較に追加' }).click();

  await expect(page.getByText('手動カードを追加しました')).toBeVisible();
  const card = comparedCards(page).filter({ hasText: 'E2E USD商品' });
  await expect(card.getByText('手動追加')).toBeVisible();
  await expect(card.getByText('15,500円換算')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ドル円レート（1ドル＝何円）' })).toHaveValue('155');
});

test('手動追加: 不正URL・javascript URL は登録されず、重複URLは警告される', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  const before = await resultCards(page).count();
  const existingUrl = await resultCards(page).first().getByRole('link', { name: '元ページを見る' }).getAttribute('href');

  await page.getByRole('button', { name: '手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  const url = dialog.getByRole('textbox', { name: /^URL/ });

  await url.fill('abc');
  await url.blur();
  await expect(dialog.getByRole('alert')).toHaveText('http または https のURLを入力してください。');
  await expect(url).toHaveAttribute('aria-invalid', 'true');

  await url.fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: '比較に追加' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText('http または https のURLを入力してください。');

  await url.fill(existingUrl ?? '');
  await url.blur();
  await expect(dialog.getByText('同じURLのカードがすでに存在します', { exact: false })).toBeVisible();
  await expect(dialog.getByText('価格を入力しないと「価格不明」と表示されます', { exact: false })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(resultCards(page)).toHaveCount(before);
  await expect(page.getByRole('heading', { name: '比較ボード (0件)' })).toBeVisible();
});

test('CSV出力: BOM付きUTF-8で、見出し・データ種別・負の利益・数式無害化が正しい', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '比較中カードをCSV出力' })).toBeDisabled();

  // 数式に見えるタイトルの手動カード（Formula Injection の再現）
  await page.getByRole('button', { name: 'URLから手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  await dialog.getByRole('textbox', { name: /^URL/ }).fill('https://jp.mercari.com/item/m_csv');
  await dialog.getByLabel('タイトル（任意）').fill('=HYPERLINK("https://evil.example","x")');
  await dialog.getByRole('textbox', { name: '価格' }).fill('9,800円');
  await dialog.getByRole('button', { name: '比較に追加' }).click();

  await page.getByRole('textbox', { name: '仕入れ価格 (円)' }).fill('10000');
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('5000');

  const { filename, raw, text } = await downloadCsv(page);
  expect(filename).toMatch(/^research-session-.*\.csv$/);
  expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

  const rows = parseCsv(text.replace(/^﻿/, ''));
  expect(rows[0]).toEqual([
    '商品名', 'サイト名', 'データ種別', 'ソース区分', '価格表示', '価格', '通貨', '送料', '状態', '信頼度', '元URL', 'メモ', '取得日時（日本時間）',
  ]);
  const cardRow = rows[1];
  expect(cardRow[0]).toBe('\'=HYPERLINK("https://evil.example","x")');
  expect(cardRow[2]).toBe('実データ');
  expect(cardRow[3]).toBe('手動追加');
  expect(cardRow[5]).toBe('9800');
  expect(cardRow[9]).toBe('高');
  const profitRow = rows.find((row) => row[0] === '利益見込み');
  expect(profitRow?.[1]).toBe('-5500');
});

test('@postdeploy リサーチ履歴: 保存→再読込しても残り、再開で保存時の比較ボードに戻る', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  await resultCards(page).nth(0).getByRole('button', { name: '比較に追加' }).click();
  await page.getByLabel('保存名').fill('E2E保存テスト');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('E2E保存テスト')).toBeVisible();

  await resultCards(page).nth(1).getByRole('button', { name: '比較に追加' }).click();
  await expect(page.getByRole('heading', { name: '比較ボード (2件)' })).toBeVisible();

  await page.reload();
  // 比較ボード自体も保存されている
  await expect(page.getByRole('heading', { name: '比較ボード (2件)' })).toBeVisible();
  await expect(page.getByText('E2E保存テスト')).toBeVisible();

  await page.getByRole('button', { name: '履歴「E2E保存テスト」を再開' }).click();
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();
  await expect(page.getByLabel(SEARCH_INPUT)).toHaveValue('PS5');
});

test('リサーチ履歴: 削除はキャンセルできて、承認すると消える', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  await page.getByLabel('保存名').fill('削除確認テスト');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const deleteButton = page.getByRole('button', { name: '履歴「削除確認テスト」を削除' });

  page.once('dialog', (dialog) => dialog.dismiss());
  await deleteButton.click();
  await expect(page.getByText('削除確認テスト')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await deleteButton.click();
  await expect(page.getByText('削除確認テスト')).toHaveCount(0);
});

test('リサーチ履歴: 上限20件を超えると古いものから消える', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  for (let i = 1; i <= 21; i += 1) {
    await page.getByLabel('保存名').fill(`履歴${String(i).padStart(2, '0')}`);
    await page.getByRole('button', { name: '保存', exact: true }).click();
  }
  await expect(page.getByText('履歴21')).toBeVisible();
  await expect(page.getByText('履歴01', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /を再開$/ })).toHaveCount(20);
});

test('検索クリアは比較ボード・利益設定を消さず、検索結果だけ消す', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PS5');
  await resultCards(page).first().getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('textbox', { name: '仕入れ価格 (円)' }).fill('1234');

  await page.getByRole('button', { name: '検索内容をクリア' }).click();
  await expect(page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '仕入れ価格 (円)' })).toHaveValue('1234');
  await expect(resultCards(page)).toHaveCount(0);
  await expect(page.getByText('該当する候補が見つかりませんでした')).toHaveCount(0);
});

test('テーマ: 切り替えると見た目と選択状態が変わり、再読込後も保たれる', async ({ page }) => {
  await page.goto('/');
  for (const [label, cls] of [
    ['Soft Market', 'theme-soft-market'],
    ['Dark Trader', 'theme-dark-trader'],
    ['Natural Board', 'theme-natural-board'],
    ['Simple Pro', 'theme-simple-pro'],
  ] as const) {
    await page.getByRole('button', { name: `テーマ: ${label}` }).click();
    await expect(page.getByRole('button', { name: `テーマ: ${label}` })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveClass(new RegExp(cls));
  }
  await page.getByRole('button', { name: 'テーマ: Dark Trader' }).click();
  const accentBefore = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--color-accent'));
  await page.reload();
  // 初回描画の時点で保存テーマが当たっている（ちらつき防止スクリプト）
  await expect(page.locator('body')).toHaveClass(/theme-dark-trader/);
  await expect(page.locator('body')).not.toHaveClass(/theme-simple-pro/);
  const accentAfter = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--color-accent'));
  expect(accentAfter).toBe(accentBefore);
});

test('日本語入力: 変換確定の Enter では検索しない', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel(SEARCH_INPUT);
  await input.fill('ぷれすて');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
  await expect(page.getByRole('heading', { name: /^検索結果/ })).toHaveCount(0);
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: /^検索結果 \(\d+件\)$/ })).toBeVisible();
});
