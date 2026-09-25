import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QUERY_LABEL, useManualFixtures } from './manual-fixtures';

/**
 * 購入者向けの「操作・導入マニュアル」PDF を作る（`npm run marketing:capture` の一部）。
 * 画面写真は毎回このアプリから撮り直すので、画面を変えてもマニュアルが古くならない。
 * 出力: dist-delivery/manual/マニュアル.pdf（納品ZIPの直下に同梱される）
 */
const OUT_DIR = path.resolve(process.cwd(), 'dist-delivery', 'manual');
const shots: Record<string, string> = {};

async function shot(name: string, target: Page | Locator) {
  const buffer = await target.screenshot({ animations: 'disabled' });
  shots[name] = `data:image/png;base64,${buffer.toString('base64')}`;
}

async function searchMulti(page: Page) {
  await page.goto('/');
  await page.getByLabel('データソースを選ぶ').selectOption('multi');
  await page.getByLabel('商品名・型番・JAN・URL').fill(QUERY_LABEL);
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('heading', { name: /^検索結果/ })).toBeVisible();
}

// 画面写真で固定ヘッダーが部品に重ならないよう、撮影時だけヘッダーの固定を外す（アプリの CSP を撮影用に無視する）。
test.use({ bypassCSP: true });
const UNSTICK_HEADER = 'header { position: static !important; }';

const overview = (page: Page) => page.getByRole('region', { name: '相場一覧（サイト別の価格帯）' });

test('マニュアル用の画面写真を撮り、PDF を作る', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await useManualFixtures(page);
  await page.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    });
  }, UNSTICK_HEADER);

  // 1. 最初の画面
  await page.goto('/');
  await page.getByLabel('データソースを選ぶ').selectOption('multi');
  await shot('top', page);

  // 2. まとめて検索 → 相場一覧
  await searchMulti(page);
  const mercari = overview(page).getByRole('listitem').filter({ has: page.getByText('メルカリ', { exact: true }) });
  await mercari.getByLabel('メルカリで見た価格（円）').fill('9500');
  await mercari.getByRole('button', { name: 'メルカリの価格を追加' }).click();
  await shot('overview', overview(page));
  await mercari.getByRole('button', { name: 'メルカリの検索ページを貼り付けて価格を取り込む' }).click();
  await page
    .getByLabel('メルカリの検索ページで「すべて選択」→「コピー」して、ここに貼り付けてください')
    .fill(['ワイヤレスイヤホン の検索結果', '¥', '9,800', '¥10,500', '¥11,200', '¥8,900', 'ケース ¥980', '送料込み'].join('\n'));
  await shot('paste', mercari);
  await page.getByRole('button', { name: /件を取り込む/ }).click();

  // 3. 検索結果（絞り込み・並べ替え・カード）
  const results = page.getByRole('heading', { name: /^検索結果/ }).locator('xpath=ancestor::div[2]');
  await page.getByRole('heading', { name: /^検索結果/ }).scrollIntoViewIfNeeded();
  await shot('results', results);

  // 4. 比較ボードと利益計算
  await page.getByRole('article').filter({ hasText: 'ノイズキャンセリング Bluetooth5.3' }).getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('article').filter({ hasText: 'Noise Cancelling Bluetooth' }).getByRole('button', { name: '比較に追加' }).click();
  await page.getByRole('button', { name: 'この価格を仕入れに使う' }).nth(1).click();
  await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('19800');
  await page.getByRole('textbox', { name: '送料 (円)' }).fill('750');
  const aside = page.locator('aside');
  await shot('compare', aside.locator('> div').first());
  await shot('profit', aside.locator('> div').nth(1));

  // 5. 検索ショートカット（まとめて開く）
  await shot('shortcuts', page.getByRole('heading', { name: '検索ショートカット（外部ページ）' }).locator('xpath=ancestor::section[1]'));

  // 6. 手動追加
  await page.getByRole('button', { name: '手動で追加' }).click();
  const dialog = page.getByRole('dialog', { name: '手動で追加' });
  await dialog.getByRole('textbox', { name: /^URL/ }).fill('https://jp.mercari.com/item/m00000000000');
  await dialog.getByRole('textbox', { name: /^URL/ }).blur();
  await dialog.getByLabel('タイトル（任意）').fill('ワイヤレスイヤホン 美品（メルカリ）');
  await dialog.getByRole('textbox', { name: '価格' }).fill('¥9,500');
  await shot('manualAdd', dialog);
  await page.keyboard.press('Escape');

  // 7. 履歴・CSV
  await page.getByLabel('保存名').fill('イヤホン 9月の相場');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await shot('history', page.getByRole('heading', { name: 'リサーチ履歴' }).locator('xpath=ancestor::section[1]'));
  await shot('csv', page.getByRole('heading', { name: 'CSVエクスポート' }).locator('xpath=ancestor::section[1]'));

  // 8. 設定前のサイトがあるとき（eBay 未設定の例）
  const setupPage = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await useManualFixtures(setupPage, { ebayNoKey: true });
  await searchMulti(setupPage);
  await shot('notConfigured', overview(setupPage));
  await setupPage.close();

  // 9. スマホ表示
  const phone = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await useManualFixtures(phone);
  await searchMulti(phone);
  await overview(phone).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
  await shot('phone', phone);
  await phone.close();

  // PDF を組み立てる
  const pkg = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
  const html = buildManualHtml(shots, `v${pkg.version}`);
  const printer = await browser.newPage();
  await printer.setContent(html, { waitUntil: 'load' });
  await fs.mkdir(OUT_DIR, { recursive: true });
  await printer.pdf({
    path: path.join(OUT_DIR, 'マニュアル.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#64748b;text-align:center;font-family:sans-serif">相場カード比較ボード 操作・導入マニュアル　<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await printer.close();
});

function figure(src: string | undefined, caption: string, width = '100%') {
  if (!src) return '';
  return `<figure><img src="${src}" style="width:${width}" alt=""><figcaption>${caption}</figcaption></figure>`;
}

function buildManualHtml(s: Record<string, string>, version: string) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>相場カード比較ボード マニュアル</title>
<style>
  body { font-family: "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.75; }
  h1 { font-size: 24pt; margin: 0 0 4mm; }
  h2 { font-size: 15pt; border-left: 5px solid #4f46e5; padding-left: 3mm; margin: 9mm 0 3mm; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
  .cover p { font-size: 12pt; color: #334155; }
  .lead { color: #334155; }
  figure { margin: 3mm 0 5mm; page-break-inside: avoid; text-align: center; }
  figure img { border: 1px solid #cbd5e1; border-radius: 6px; max-height: 118mm; max-width: 100%; object-fit: contain; }
  .two figure img { max-height: 92mm; }
  figcaption { font-size: 9pt; color: #475569; margin-top: 1.5mm; }
  table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 1.8mm 2.5mm; text-align: left; vertical-align: top; }
  th { background: #eef2ff; }
  code { background: #f1f5f9; padding: 0.3mm 1.2mm; border-radius: 3px; font-size: 9.5pt; }
  .compact table { font-size: 8.5pt; }
  .compact td code { font-size: 7.8pt; }
  .compact h3 { margin-top: 4mm; }
  pre { background: #0f172a; color: #e2e8f0; padding: 3mm 4mm; border-radius: 6px; font-size: 9pt; white-space: pre-wrap; page-break-inside: avoid; }
  .note { background: #fff7ed; border: 1px solid #fdba74; border-radius: 6px; padding: 2.5mm 4mm; margin: 3mm 0; page-break-inside: avoid; }
  .page { page-break-before: always; }
  ol li, ul li { margin: 0.8mm 0; }
  .two { display: flex; gap: 5mm; align-items: flex-start; }
  .two > * { flex: 1; }
</style></head><body>

<section class="cover">
  <p>物販・せどり向け 相場リサーチ補助ツール</p>
  <h1>相場カード比較ボード<br>操作・導入マニュアル</h1>
  <p>${version ? `バージョン ${version}` : ''}</p>
  <p class="lead">楽天市場・Yahoo!ショッピング・eBay の価格をまとめて検索し、メルカリ・ヤフオク等で見た価格も含めて、サイト別の相場を一目で比較。利益の見込みまでその場で確認できます。</p>
  <p class="lead">画面の写真は、このツールの実際の画面です（商品・店舗名は説明用の架空のものです）。</p>
</section>

<section class="page">
  <h2>1. このツールでできること</h2>
  <table>
    <tr><th>できること</th><th>内容</th></tr>
    <tr><td>まとめて検索</td><td>商品名・型番・JANコードで、楽天市場・Yahoo!ショッピング・eBay を同時に検索し、画像つきカードで並べます（eBay はドル建てを円に換算）。</td></tr>
    <tr><td>相場一覧</td><td>サイトごとの価格帯（最安〜最高・中央値）を同じ目盛りの横棒で並べ、一番安いサイトに「最安」を付けます。付属品など相場から大きく外れた価格は自動で除きます。</td></tr>
    <tr><td>メルカリ等の価格も並べる</td><td>メルカリ・ヤフオク・ラクマ・Amazon は検索ページを画面分割でまとめて開き、見た価格を入力すると相場一覧に並びます。</td></tr>
    <tr><td>比較・利益計算</td><td>気になる商品を比較ボードに集め、仕入れ・販売価格、送料、手数料から利益の見込みを計算します。</td></tr>
    <tr><td>保存・書き出し</td><td>リサーチ履歴（最大20件）と、Excel で開ける CSV に書き出せます。</td></tr>
  </table>
  <h3>できないこと（あらかじめご確認ください）</h3>
  <ul>
    <li>メルカリ・ヤフオク・ラクマ・Amazon の価格の自動取得はしません（公式の検索APIが無く、自動取得は各サイトの規約違反になるためです）。</li>
    <li>表示価格は検索時点の参考値です。購入・出品の前に、必ず「元ページを見る」で価格・送料・状態を確かめてください。</li>
    <li>利益計算に、消費税・関税・取引ごとの固定手数料は含まれません。</li>
  </ul>
</section>

<section class="page">
  <h2>2. 画面の見かた</h2>
  ${figure(s.top, '最初の画面。上のバッジで、いま見ているデータの種類が分かります。')}
  <table>
    <tr><th>表示</th><th>意味</th></tr>
    <tr><td>緑「実データ表示中」</td><td>各サイトの公式API から取得した、実際の商品を表示しています。</td></tr>
    <tr><td>黄「デモ表示中 — サンプル/見本データ」</td><td>操作確認用のサンプル、またはどのサイトにも接続できず見本データ（実在しない商品）を表示しています。</td></tr>
    <tr><td>青「…モード — 検索すると接続します」</td><td>データソースを選んだ直後で、まだ検索していない状態です。</td></tr>
  </table>
  <p>「データソース」は <b>まとめて（楽天・Yahoo!・eBay）</b> が基本です。楽天だけで調べたいときは「楽天市場のみ」、操作を試すだけなら「サンプルデータ」を選びます。</p>
</section>

<section class="page">
  <h2>3. 基本の使い方</h2>
  <h3>① まとめて探す</h3>
  <p>検索欄に商品名・型番・JANコードを入れ、「まとめて探す」を押します。3つのサイトを同時に検索し、結果の上に「相場一覧」が表示されます。</p>
  ${figure(s.overview, '相場一覧。横棒の位置で、サイトごとの価格帯を比べられます（白い縦線は中央値）。')}
  <ul>
    <li>「最安」が付いたサイトが、価格帯の下限がいちばん安いサイトです。</li>
    <li>付属品やまとめ売りなど、相場から大きく外れた価格は自動で除き、黄色の帯でお知らせします。「含めて表示する」で元に戻せます。</li>
  </ul>
  <h3>② 結果を絞り込む・並べ替える</h3>
  ${figure(s.results, '検索結果。サイト名のボタンで絞り込み、「並べ替え」で安い順（ドル建ても円換算）にできます。')}
  <p>カードの上のラベルで、情報の出どころが分かります。「公式API取得」は各サイトの公式データ、「手動追加」はご自身で入力したものです。相場から外れた価格には注意のラベルが付きます。</p>
</section>

<section>
  <div style="page-break-inside: avoid">
  <h3>③ 比較に追加して、利益を確認する</h3>
  <div class="two">
    ${figure(s.compare, '比較ボード。気になる商品を集めて見比べます。')}
    ${figure(s.profit, '利益見込み計算。販売価格・送料を入れると利益と利益率が出ます。')}
  </div>
  </div>
  <ol>
    <li>カードの「比較に追加」を押すと、右側（スマホでは下）の比較ボードに入ります。比較ボードはページを閉じても残ります（最大50件）。</li>
    <li>比較ボードの「この価格を仕入れに使う」「この価格を販売に使う」で、利益計算に価格が入ります。</li>
    <li>送料と手数料率を入れると、<b>利益 ＝ 販売価格 − 手数料（1円未満切り捨て） − 仕入れ価格 − 送料</b> で計算します。</li>
    <li>金額は全角数字や「¥12,800」のような書き方でも入力できます。</li>
  </ol>
  <h3>④ 元ページで確かめる</h3>
  <p>カードの「元ページを見る」で、各サイトの商品ページが開きます。購入・出品の前に、必ず実際の価格・送料・状態を確認してください。</p>
</section>

<section class="page">
  <h2>4. メルカリ・ヤフオク等の価格も並べて比較する</h2>
  <p>メルカリ・ヤフオク・ラクマ・Amazon は自動取得できないため（公式の検索APIが無く、自動取得は規約違反になるため）、
  <b>ツールを左、各サイトを右に並べて見ながら</b>、価格をまとめて取り込みます。</p>
  <h3>① 画面を並べる</h3>
  <ol>
    <li>このツールのウィンドウを、画面の左側（3分の1ほど）に寄せます。</li>
    <li>「検索ショートカット」の <b>まとめて開く（右側に画面分割）</b> を押すと、チェックしたサイトの検索ページが画面の右側に格子状に並んで開きます。相場一覧の各行の「開く」も同じ位置に開きます。</li>
    <li>初回はブラウザがウィンドウをブロックすることがあります。アドレスバー右端のポップアップのアイコンから「許可」を選び、もう一度押してください。</li>
  </ol>
  ${figure(s.shortcuts, '検索ショートカット。チェックしたサイトを「まとめて開く」で右側に並べます。')}
  <h3>② 価格をまとめて取り込む（貼り付け）</h3>
  <ol>
    <li>右側に開いた検索ページで、<b>すべて選択（Ctrl+A／Mac は Cmd+A）→ コピー（Ctrl+C）</b> します。</li>
    <li>相場一覧のそのサイトの行にある <b>貼り付けボタン</b> を押し、表示された欄に貼り付けます（Ctrl+V）。</li>
    <li>見つかった価格の件数と範囲が表示されるので、「○件を取り込む」を押します。クーポン・ポイント・送料の金額は自動で除き、付属品など相場から外れた価格も価格帯から除きます。</li>
  </ol>
  ${figure(s.paste, '貼り付け取り込み。ページ全体をコピーして貼るだけで、価格を一括で並べます。')}
  <p>取り込んだ価格には「検索表示から推定」と表示されます（商品ごとの状態や送料は元ページで確認してください）。1件だけ登録したいときは「見た価格」に入力して「＋」を押します。</p>
  <h3>商品を1件ずつ登録する（手動で追加）</h3>
  ${figure(s.manualAdd, '手動で追加。URL を貼るとサイト名が自動で入り、そのまま価格欄へ進みます。', '70%')}
</section>

<section class="page">
  <h2>5. 保存と書き出し</h2>
  <div class="two">
    ${figure(s.history, 'リサーチ履歴。名前を付けて保存し、あとで「再開」できます。')}
    ${figure(s.csv, 'CSV 出力。比較ボードの内容を Excel で開ける形式で保存します。')}
  </div>
  <ul>
    <li>履歴は最大20件で、超えると古いものから消えます。「再開」は保存したときの結果を戻すだけで、再検索はしません。</li>
    <li>CSV は文字化けしない形式（BOM 付き UTF-8）です。「=」などで始まる文字は、表計算ソフトで数式として実行されないよう無害化します。</li>
    <li>データはお使いのブラウザの中にだけ保存されます（ブラウザのデータを消すと消えます）。</li>
  </ul>
  <h3>スマートフォンでも使えます</h3>
  ${figure(s.phone, 'スマートフォンでの表示。右側のパネルは下に並びます。', '42%')}
</section>

<section class="page compact">
  <h2>6. 公開のしかた（導入）</h2>
  <p>届いた ZIP には、すぐ公開できる <code>app-static/</code> と、実データ版を公開するための <code>source/</code> が入っています。画面ごとの入力内容など詳しい手順は ZIP 内の <code>DEPLOY_GUIDE.md</code> にあります。</p>
  <h3>A. まず試す（楽天・Yahoo!・eBay の実データなし）</h3>
  <ol>
    <li><a href="https://dash.cloudflare.com/">Cloudflare</a> に無料登録し、「Workers &amp; Pages → 作成 → Pages → アセットをアップロード」を選びます。</li>
    <li><code>app-static</code> フォルダの中身をドラッグ＆ドロップして「デプロイ」します。表示された URL を開けば完了です。</li>
  </ol>
  <h3>B. 実データ版を公開する（推奨）</h3>
  <ol>
    <li>パソコンに <a href="https://nodejs.org/">Node.js 22</a> を入れ、<code>source</code> フォルダでターミナルを開きます。</li>
    <li>次を順に実行します。ブラウザが開いたら Cloudflare にログインして許可します。</li>
  </ol>
  <pre>npm ci
npx wrangler login
npm run deploy</pre>
  <p>表示された <code>https://coconala-tool.○○.workers.dev</code> が公開URLです。続けて、使うサイトのキーを登録します（使うサイトの分だけで大丈夫です）。</p>
  <table>
    <tr><th>サイト</th><th>取得する場所</th><th>登録するコマンド</th></tr>
    <tr><td>楽天市場</td><td>楽天ウェブサービスで「アプリID発行」。許可されたWebサイトに公開URLのドメイン、スコープは「楽天市場API」。</td><td><code>npx wrangler secret put SERVER_RAKUTEN_APP_ID</code><br><code>npx wrangler secret put SERVER_RAKUTEN_ACCESS_KEY</code></td></tr>
    <tr><td>Yahoo!ショッピング</td><td>Yahoo!デベロッパーネットワークで「新しいアプリケーションを開発」（ID連携を利用しない）。</td><td><code>npx wrangler secret put SERVER_YAHOO_CLIENT_ID</code></td></tr>
    <tr><td>eBay</td><td>eBay Developers Program で Production のキーセットを作成（登録の承認に1営業日ほどかかります）。</td><td><code>npx wrangler secret put SERVER_EBAY_CLIENT_ID</code><br><code>npx wrangler secret put SERVER_EBAY_CLIENT_SECRET</code></td></tr>
  </table>
  <div class="note" style="margin-top:2mm">キーは秘密の情報です。画面やファイルには書かず、上のコマンドで Cloudflare にだけ登録してください。楽天のアプリには約1年の有効期限があり、期限前に楽天ウェブサービスの一覧で「有効期限延長」が必要です。</div>
</section>

<section class="page">
  <h2>7. 困ったとき</h2>
  ${figure(s.notConfigured, 'キーを設定していないサイトは、相場一覧に理由が表示され、他のサイトの結果だけが並びます。')}
  <table>
    <tr><th>表示されるメッセージ</th><th>原因と対処</th></tr>
    <tr><td>連携がまだ設定されていません</td><td>そのサイトのキーが未登録です。「6. 公開のしかた」のコマンドで登録してください（再公開は不要）。</td></tr>
    <tr><td>キーまたは許可サイトの設定を確認してください</td><td>キーの貼り間違い、楽天の「許可されたWebサイト」と公開URLの不一致、または楽天アプリの有効期限切れです。</td></tr>
    <tr><td>短時間に検索が集中しました</td><td>1分ほど待ってから、もう一度検索してください。</td></tr>
    <tr><td>応答が遅いため表示できませんでした／接続できませんでした</td><td>そのサイト側の一時的な問題か、通信環境の問題です。時間をおいて試してください。</td></tr>
    <tr><td>楽天市場ではこの検索語を使えません</td><td>英数字1文字だけの語などは楽天で検索できません。語を足すか変えてください。</td></tr>
    <tr><td>ブラウザが○個のウィンドウをブロックしました</td><td>「まとめて開く」のポップアップがブロックされています。アドレスバー右端のアイコンから許可してください。</td></tr>
  </table>
  <h3>データと安全について</h3>
  <ul>
    <li>各サイトのキーはサーバー（Cloudflare）にだけ保存され、画面やブラウザには出ません。</li>
    <li>検索履歴や比較ボードはお使いのブラウザの中にだけ保存され、制作者に送られることはありません。</li>
    <li>画面の一番下にある「Supported by Rakuten Developers」「Webサービス by Yahoo! JAPAN」は各社の規約で必要な表記です。消さないでください。</li>
  </ul>
  <h3>サポート</h3>
  <p>ZIP 内の <code>SUPPORT_POLICY.md</code> の範囲で、ココナラのメッセージからご連絡ください。</p>
</section>
</body></html>`;
}
