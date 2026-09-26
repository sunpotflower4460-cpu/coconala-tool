import AxeBuilder from '@axe-core/playwright';
import { closeSetupIfOpen, expect, FAKE, openedUrls, saveTestKeys, search, siteViews, test } from './fixtures';

/**
 * デスクトップ版（Electron）の動的監査。
 * アプリ本体 → worker.ts（/api/*）→ 偽の公式API、右のタブ → 架空の検索ページ（偽サーバー）の経路で確認する。
 */

test('初回起動で設定（キーの登録）が開き、「あとで設定する」で閉じる。2回目の起動では勝手に開かない', async ({ launch }) => {
  const first = await launch();
  const dialog = first.page.getByRole('dialog', { name: '設定 — はじめに' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('楽天市場', { exact: true })).toBeVisible();
  // 設定中は右のタブ（実ページ）を隠す
  expect((await siteViews(first.app)).every((v) => !v.visible)).toBe(true);
  await dialog.getByRole('button', { name: 'あとで設定する' }).click();
  await expect(dialog).toHaveCount(0);
  await first.app.close();

  const second = await launch({ userData: first.userData });
  await expect(second.page.getByRole('button', { name: 'Nintendo Switch 2 で試してみる' })).toBeVisible();
  await expect(second.page.getByRole('dialog')).toHaveCount(0);
});

test('キー設定: コピー欄の内容・保存してテスト（成功・キー違い）・値は画面に残らない', async ({ launch }) => {
  const { page, app } = await launch();
  const dialog = page.getByRole('dialog', { name: /設定/ });
  await dialog.getByRole('button', { name: '次へ（楽天市場）' }).click();
  await expect(dialog.getByText('coconala-tool.sunpotflower4460.workers.dev', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '楽天の登録ページを開く' }).click();
  expect(await openedUrls(app)).toContain('https://webservice.rakuten.co.jp/app/create');

  // キー違い（偽サーバーが 401 を返す）
  await dialog.getByLabel('アプリケーションID').fill('e2e-app');
  await dialog.getByLabel('アクセスキー').fill('e2e-wrong-key');
  await dialog.getByRole('button', { name: '保存してテスト' }).click();
  await expect(dialog.getByRole('status')).toContainText('キーが違うか、楽天の「許可されたWebサイト」に coconala-tool.sunpotflower4460.workers.dev が入っていないようです');

  // 正しいキー
  await dialog.getByLabel('アプリケーションID').fill('e2e-app');
  await dialog.getByLabel('アクセスキー').fill('e2e-key');
  await dialog.getByRole('button', { name: '保存してテスト' }).click();
  await expect(dialog.getByRole('status')).toContainText('使えます');
  await expect(dialog.getByLabel('アクセスキー')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: /楽天市場.*設定済み|2\. 楽天市場/ })).toBeVisible();

  // 楽天へは許可サイトの Origin を付けて問い合わせている
  const upstream = (await (await fetch(`${FAKE}/__requests`)).json()) as Array<Record<string, string | null>>;
  expect(upstream.filter((r) => r.accessKey === 'e2e-key').at(-1)).toMatchObject({ origin: 'https://coconala-tool.sunpotflower4460.workers.dev' });

  // 画面側に渡るのは「設定済みかどうか」だけ
  const status = await page.evaluate(() => window.desktop?.keys.status());
  expect(JSON.stringify(status)).not.toContain('e2e-key');
  expect(status?.rakuten.configured).toBe(true);
  expect(await page.content()).not.toContain('e2e-key');
});

test('まとめて探す1回で: 楽天・Yahoo! は画像つきカード、eBay はキー未設定の案内、メルカリ等は右のタブに実ページ', async ({ launch }) => {
  const { page, app } = await launch();
  await saveTestKeys(page);
  await closeSetupIfOpen(page);
  await search(page, 'Switch 2');

  const strip = page.getByRole('region', { name: 'サイトごとの状況' });
  await expect(strip.getByRole('button', { name: /楽天市場\s*3件/ })).toBeVisible();
  await expect(strip.getByRole('button', { name: /Yahoo!ショッピング\s*3件/ })).toBeVisible();
  await expect(strip.getByRole('button', { name: /eBay.*キーが未設定です/ })).toBeVisible();
  await expect(page.getByTestId('result-summary')).toContainText('楽天市場・Yahoo!ショッピング から 6件（画像つき）');
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(6);
  await expect(cards.first().locator('img')).toHaveCount(1);
  // 既定は安い順（Yahoo! ¥9,000 が先頭）
  await expect(cards.first()).toContainText('¥9,000');

  // 4サイトの検索ページが1回ずつ開き、表示中のタブ（メルカリ）だけが右の枠に重なる
  await expect.poll(async () => (await siteViews(app)).map((v) => v.url).sort()).toEqual(
    ['amazon', 'mercari', 'rakuma', 'yahoo_auctions'].map((m) => `${FAKE}/fake-sites/${m}?q=Switch%202`),
  );
  const frame = await page.getByTestId('site-frame').boundingBox();
  const visible = (await siteViews(app)).filter((v) => v.visible);
  expect(visible).toHaveLength(1);
  expect(visible[0].url).toContain('/fake-sites/mercari');
  expect(Math.abs(visible[0].bounds.x - (frame?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs(visible[0].bounds.width - (frame?.width ?? 0))).toBeLessThanOrEqual(1);

  await page.getByRole('tab', { name: 'ヤフオク' }).click();
  await expect.poll(async () => (await siteViews(app)).filter((v) => v.visible).map((v) => v.url)).toEqual([`${FAKE}/fake-sites/yahoo_auctions?q=Switch%202`]);
  await page.getByRole('tab', { name: '比較・利益' }).click();
  await expect.poll(async () => (await siteViews(app)).some((v) => v.visible)).toBe(false);
  await expect(page.getByRole('heading', { name: '利益見込み計算' })).toBeVisible();

  // eBay の案内を押すと、eBay の設定が開く
  await strip.getByRole('button', { name: /eBay/ }).click();
  await expect(page.getByRole('dialog', { name: '設定 — eBay（任意）' })).toBeVisible();
});

test('値段を取り込む1回で、メルカリ・ヤフオク・ラクマ・Amazon の値段とリンクが一覧に並ぶ（画像なし・出所つき）', async ({ launch }) => {
  const { page, app } = await launch();
  await saveTestKeys(page);
  await closeSetupIfOpen(page);
  await search(page, 'Switch 2');
  const capture = page.getByRole('button', { name: /値段を取り込む/ });
  await expect(capture).toBeEnabled();
  await capture.click();

  const notice = page.getByRole('status').filter({ hasText: '値段を取り込みました' });
  await expect(notice).toContainText('メルカリ: 5件');
  await expect(notice).toContainText('ヤフオク: 4件');
  await expect(notice).toContainText('ラクマ: 4件');
  await expect(notice).toContainText('Amazon: 4件');
  await expect(page.getByRole('article')).toHaveCount(23);
  await expect(page.getByTestId('result-summary')).toContainText('取り込んだ値段 17件');

  // 取り込んだカード: 画像なし・「検索表示から推定」・商品ページURL（クエリなし）
  const yahuoku = page.getByRole('article').filter({ hasText: '【E2Eヤフオク】Switch 2 出品1' });
  await expect(yahuoku).toContainText('¥6,900');
  await expect(yahuoku.getByText('検索表示から推定')).toBeVisible();
  await expect(yahuoku.locator('img')).toHaveCount(0);
  await expect(yahuoku.getByText('ヤフオクの画面から取り込んだ値段（画像は取り込みません）')).toBeVisible();
  await yahuoku.getByRole('link', { name: '元ページを見る' }).click();
  await expect.poll(() => openedUrls(app)).toContain('https://auctions.yahoo.co.jp/jp/auction/x1001');

  // Amazon は参考価格ではなく販売価格、ナビのリンクは入らない
  await expect(page.getByRole('article').filter({ hasText: '【E2EAmazon】Switch 2 商品1' })).toContainText('¥9,500');
  await expect(page.getByRole('article').filter({ hasText: 'タイムセール' })).toHaveCount(0);

  // 付属品（¥300）は相場から外れた価格として注意が付き、相場一覧の価格帯から除かれる
  await expect(page.getByRole('article').filter({ hasText: '保護フィルム' }).getByText('相場より大幅に安い（付属品等の可能性）')).toBeVisible();
  const mercariRow = page.getByRole('list', { name: 'サイト別の価格帯' }).getByRole('listitem').filter({ has: page.getByText('取り込み') }).first();
  await expect(mercariRow).toBeVisible();

  // チップにも件数が出る。サイト名で絞り込める
  await expect(page.getByRole('region', { name: 'サイトごとの状況' }).getByRole('button', { name: /メルカリ\s*取り込み 5件/ })).toBeVisible();
  await page.getByRole('group', { name: 'サイトで絞り込む' }).getByRole('button', { name: /ラクマ/ }).click();
  await expect(page.getByRole('article')).toHaveCount(4);
});

test('ログイン画面などで値段が無いサイトは「読み取れませんでした」と案内し、他のサイトは取り込む', async ({ launch }) => {
  const { page } = await launch();
  await closeSetupIfOpen(page);
  await search(page, '__login テスト');
  await page.getByRole('button', { name: /値段を取り込む/ }).click();
  const notice = page.getByRole('status').filter({ hasText: '一部のサイトは読み取れませんでした' });
  await expect(notice).toContainText('メルカリ: 値段を読み取れませんでした（ログインや確認画面が出ていないか、右のタブで確認してください）');
  // キー未設定でもメルカリ等のタブと取り込みは使える
  await expect(page.getByTestId('result-summary')).toContainText('画像つきで表示できる商品はまだありません');
});

test('設定で取り込みをオフにしたサイトは取り込まない（タブで見るだけ）', async ({ launch }) => {
  const { page } = await launch();
  const dialog = page.getByRole('dialog', { name: '設定 — はじめに' });
  await dialog.getByRole('checkbox', { name: 'Amazon' }).uncheck();
  await dialog.getByRole('button', { name: 'あとで設定する' }).click();
  await search(page, 'Switch 2');
  await page.getByRole('button', { name: /値段を取り込む/ }).click();
  const notice = page.getByRole('status').filter({ hasText: '値段を取り込みました' });
  await expect(notice).toContainText('Amazon: 取り込みをオフにしています');
  await expect(page.getByRole('article').filter({ hasText: '【E2EAmazon】' })).toHaveCount(0);
});

test('右のタブで商品ページ等に移っているサイトは取り込まず、検索結果に戻すよう案内する。新しく検索したら前のお知らせは消える', async ({ launch }) => {
  const { page, app } = await launch();
  await closeSetupIfOpen(page);
  await search(page, 'Switch 2');
  await expect.poll(async () => (await siteViews(app)).length).toBe(4);
  await expect(page.getByRole('button', { name: /値段を取り込む/ })).toBeEnabled();
  // メルカリのタブだけ、検索結果ではないページへ移動させる
  await app.evaluate(async ({ BrowserWindow }, url) => {
    const views = BrowserWindow.getAllWindows()[0].contentView.children.filter((v) => 'webContents' in v) as unknown as Array<{
      webContents: { getURL(): string; loadURL(u: string): Promise<void> };
    }>;
    const mercari = views.find((v) => v.webContents.getURL().includes('/fake-sites/mercari'));
    await mercari?.webContents.loadURL(url);
  }, `${FAKE}/__health`);
  await page.getByRole('button', { name: /値段を取り込む/ }).click();
  const notice = page.getByRole('status').filter({ hasText: '一部のサイトは読み取れませんでした' });
  await expect(notice).toContainText('メルカリ: 検索結果以外のページを表示中です');
  await expect(notice).toContainText('ヤフオク: 4件');
  await expect(page.getByRole('article').filter({ hasText: '【E2Eメルカリ】' })).toHaveCount(0);

  await search(page, 'Switch 3');
  await expect(page.getByRole('status').filter({ hasText: '値段の取り込み結果' })).toHaveCount(0);
});

test('比較・キー・取り込みの設定は再起動後も残る', async ({ launch }) => {
  const first = await launch();
  await saveTestKeys(first.page);
  await closeSetupIfOpen(first.page);
  await search(first.page, 'Switch 2');
  await first.page.getByRole('article').first().getByRole('button', { name: '比較に追加' }).click();
  await first.app.close();

  const second = await launch({ userData: first.userData });
  const status = await second.page.evaluate(() => window.desktop?.keys.status());
  expect(status?.rakuten.configured).toBe(true);
  expect(status?.yahoo.configured).toBe(true);
  await second.page.getByRole('tab', { name: '比較・利益' }).click();
  await expect(second.page.getByRole('heading', { name: '比較ボード (1件)' })).toBeVisible();
});

test('安全性: 実ページのタブからはアプリの機能に触れず、アプリ画面は外部サイトへ移動しない', async ({ launch }) => {
  const { page, app } = await launch();
  await closeSetupIfOpen(page);
  await search(page, 'Switch 2');
  await expect.poll(async () => (await siteViews(app)).length).toBe(4);
  const inView = await app.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children.find((v) => 'webContents' in v) as unknown as {
      webContents: { executeJavaScript(code: string): Promise<unknown> };
    };
    return view.webContents.executeJavaScript('[typeof window.desktop, typeof require, typeof process].join(",")');
  });
  expect(inView).toBe('undefined,undefined,undefined');
  expect(await page.evaluate(() => [typeof (window as unknown as { require?: unknown }).require, typeof (window as unknown as { process?: unknown }).process].join(','))).toBe(
    'undefined,undefined',
  );

  await page.evaluate(() => {
    window.location.href = 'https://example.com/';
  });
  await expect.poll(() => openedUrls(app)).toContain('https://example.com/');
  expect(page.url()).toMatch(/^app:\/\/bundle\//);
});

test('アクセシビリティ: 検索後の画面と設定に重大な違反がない', async ({ launch }) => {
  const { page } = await launch();
  const audit = async (include?: string) => {
    let builder = new AxeBuilder({ page }).setLegacyMode(true).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    if (include) builder = builder.include(include);
    const results = await builder.analyze();
    return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target}`);
  };
  // 設定ダイアログ（背景は暗くしているので、ダイアログの中だけを確認する）
  expect(await audit('[role="dialog"]')).toEqual([]);
  await closeSetupIfOpen(page);
  await saveTestKeys(page);
  await search(page, 'Switch 2');
  await page.getByRole('button', { name: /値段を取り込む/ }).click();
  await expect(page.getByText('値段を取り込みました')).toBeVisible();
  expect(await audit()).toEqual([]);
});
