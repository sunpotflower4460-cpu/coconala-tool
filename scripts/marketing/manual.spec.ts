import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEMO_QUERY, launchDesktop, withMarks, withSitePage } from './desktopApp';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 購入者向けの「かんたん操作マニュアル」PDF を作る（`npm run marketing:capture` の一部）。
 * デスクトップアプリ（dist-desktop/）を実際に起動して画面写真を撮り直すので、画面を変えてもマニュアルが古くならない。
 * 商品・店舗・右側のサイトのページは、偽サーバー（127.0.0.1:43174）が返す説明用の架空のもの。
 * 出力: dist-delivery/manual/マニュアル.pdf（納品物の ②マニュアル.pdf）
 */
const OUT_DIR = path.resolve(process.cwd(), 'dist-delivery', 'manual');
const QUERY = DEMO_QUERY;
const shots: Record<string, string> = {};

async function shot(name: string, target: Page | Locator) {
  const buffer = await target.screenshot({ animations: 'disabled' });
  shots[name] = `data:image/png;base64,${buffer.toString('base64')}`;
}

test('デスクトップアプリの画面写真を撮り、マニュアル PDF を作る', async ({ browser }) => {
  test.setTimeout(240_000);
  const userData = mkdtempSync(path.join(os.tmpdir(), 'soba-manual-'));
  const { app, page } = await launchDesktop(userData);
  try {
    // 1. 初回起動の設定
    const wizard = page.getByRole('dialog', { name: /設定/ });
    await expect(wizard).toBeVisible();
    await shot('setupOverview', wizard);
    await wizard.getByRole('button', { name: '次へ（楽天市場）' }).click();
    await wizard.getByLabel('アプリケーションID').fill('e2e-app');
    await wizard.getByLabel('アクセスキー').fill('e2e-key');
    await wizard.getByRole('button', { name: '保存してテスト' }).click();
    await expect(wizard.getByRole('status')).toContainText('使えます');
    const scroller = wizard.locator('.overflow-y-auto').first();
    await scroller.evaluate((el) => el.scrollTo(0, 0));
    await shot('setupRakutenTop', wizard);
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot('setupRakutenBottom', wizard);
    await wizard.getByRole('button', { name: /^3\. Yahoo!ショッピング/ }).click();
    await wizard.getByLabel('Client ID').fill('e2e-yahoo');
    await wizard.getByRole('button', { name: '保存してテスト' }).click();
    await expect(wizard.getByRole('status')).toContainText('使えます');
    await wizard.getByRole('button', { name: /^1\. はじめに/ }).click();
    await shot('setupDone', wizard);
    await wizard.getByRole('button', { name: 'あとで設定する' }).click();

    // 2. 最初の画面
    await shot('start', page);

    // 3. まとめて探す
    await page.getByLabel('商品名・型番・JAN・URL').fill(QUERY);
    await page.getByRole('button', { name: 'まとめて探す' }).click();
    await expect(page.getByTestId('result-summary')).toBeVisible();
    await expect(page.getByRole('button', { name: /値段を取り込む/ })).toBeEnabled();
    await page.waitForTimeout(800);
    await withSitePage(app, page, () =>
      withMarks(
        page,
        [
          [page.getByLabel('商品名・型番・JAN・URL'), 1],
          [page.getByRole('button', { name: 'まとめて探す' }), 2],
          [page.getByRole('region', { name: 'サイトごとの状況' }).getByRole('list'), 3],
          [page.getByRole('button', { name: /値段を取り込む/ }), 4],
          [page.getByRole('tablist', { name: '右側の表示' }), 5],
        ],
        () => shot('searched', page),
      ),
    );

    // 4. 値段を取り込む
    await page.getByRole('button', { name: /値段を取り込む/ }).click();
    await expect(page.getByText('値段を取り込みました')).toBeVisible();
    await shot('captureNotice', page.getByRole('status').filter({ hasText: '値段を取り込みました' }));
    await shot('summary', page.getByTestId('result-summary'));
    await page.locator('#desktop-results').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await withSitePage(app, page, () => shot('results', page));
    await shot('cardApi', page.getByRole('article').filter({ hasText: 'ノイズキャンセリング Bluetooth5.3' }));
    await shot('cardCaptured', page.getByRole('article').filter({ hasText: 'メルカリの画面から取り込んだ値段' }).first());
    const overview = page.getByRole('region', { name: '相場一覧（サイト別の価格帯）' });
    await overview.scrollIntoViewIfNeeded();
    await shot('overview', overview);

    // 5. 比較・利益
    await page.getByRole('article').filter({ hasText: 'ノイズキャンセリング Bluetooth5.3' }).getByRole('button', { name: '比較に追加' }).click();
    await page.getByRole('article').filter({ hasText: 'メルカリの画面から取り込んだ値段' }).first().getByRole('button', { name: '比較に追加' }).click();
    await page.getByRole('tab', { name: '比較・利益' }).click();
    await page.getByRole('button', { name: 'この価格を仕入れに使う' }).nth(1).click();
    await page.getByRole('textbox', { name: '販売価格 (円)' }).fill('14800');
    await page.getByRole('textbox', { name: '送料 (円)' }).fill('750');
    await shot('compare', page.getByRole('region', { name: 'サイトのページと比較' }));

    // 6. 保存・CSV
    await page.getByRole('tab', { name: '保存・CSV' }).click();
    await page.getByLabel('保存名').fill('イヤホン 9月の相場');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await shot('history', page.getByRole('region', { name: 'サイトのページと比較' }));

    // 7. 設定（取り込みのオン・オフ）
    await page.getByRole('button', { name: '設定（キーの登録）' }).click();
    await shot('captureSettings', page.getByRole('group', { name: /値段の取り込み/ }));
    await page.keyboard.press('Escape');
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }

  const pkg = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
  const printer = await browser.newPage();
  await printer.setContent(buildManualHtml(shots, `v${pkg.version}`), { waitUntil: 'load' });
  await fs.mkdir(OUT_DIR, { recursive: true });
  await printer.pdf({
    path: path.join(OUT_DIR, 'マニュアル.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#64748b;text-align:center;font-family:sans-serif">相場カード比較ボード かんたん操作マニュアル　<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
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
  body { font-family: "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.8; }
  h1 { font-size: 24pt; margin: 0 0 4mm; }
  h2 { font-size: 15pt; border-left: 5px solid #4f46e5; padding-left: 3mm; margin: 8mm 0 3mm; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 5mm 0 2mm; page-break-after: avoid; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
  .cover p { font-size: 12pt; color: #334155; }
  figure { margin: 3mm 0 5mm; page-break-inside: avoid; text-align: center; }
  figure img { border: 1px solid #cbd5e1; border-radius: 6px; max-height: 120mm; max-width: 100%; object-fit: contain; }
  .two figure img { max-height: 95mm; }
  figcaption { font-size: 9pt; color: #475569; margin-top: 1.5mm; }
  table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 1.8mm 2.5mm; text-align: left; vertical-align: top; }
  th { background: #eef2ff; }
  .note { background: #fff7ed; border: 1px solid #fdba74; border-radius: 6px; padding: 2.5mm 4mm; margin: 3mm 0; page-break-inside: avoid; }
  .tip { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 2.5mm 4mm; margin: 3mm 0; page-break-inside: avoid; }
  .num { display: inline-block; width: 1.5em; height: 1.5em; line-height: 1.5em; border-radius: 50%; background: #ef4444; color: #fff; text-align: center; font-weight: 700; font-size: 9pt; }
  .page { page-break-before: always; }
  ol li, ul li { margin: 1mm 0; }
  .two { display: flex; gap: 5mm; align-items: flex-start; }
  .two > * { flex: 1; }
  b.btn { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 0 1.5mm; font-weight: 700; }
</style></head><body>

<section class="cover">
  <p>物販・せどり向け 相場リサーチ補助アプリ</p>
  <h1>相場カード比較ボード<br>かんたん操作マニュアル</h1>
  <p>${version ? `バージョン ${version}` : ''}</p>
  <p>商品名を入れて<b>「まとめて探す」</b>を押すだけで、楽天市場・Yahoo!ショッピング・eBay の商品が<b>画像つき</b>で並び、
  メルカリ・ヤフオク・ラクマ・Amazon の検索結果も<b>同じ画面の右側</b>に開きます。<b>「値段を取り込む」</b>を押せば、それらの値段も一覧に加わります。</p>
  <p style="font-size:10pt;color:#64748b">写真の商品・店舗名・右側のページは説明用の架空のものです。実際には各サイトの本物の商品とページが表示されます。</p>
</section>

<section class="page">
  <h2>1. 届いたファイルと、使うもの</h2>
  <p>届くファイルは5つです。<b>①はお使いのパソコンに合うものを1つだけ</b>使います。</p>
  <table>
    <tr><th>ファイル</th><th>使う人</th></tr>
    <tr><td><b>①アプリ（Windows用）.exe</b></td><td>Windows のパソコン</td></tr>
    <tr><td><b>①アプリ（Mac・Appleシリコン用）.dmg</b></td><td>2020年末以降の多くの Mac（チップが「Apple M1」「M2」「M3」「M4」など）</td></tr>
    <tr><td><b>①アプリ（Mac・Intel用）.dmg</b></td><td>それより前の Mac（プロセッサが「Intel」）</td></tr>
    <tr><td><b>②マニュアル.pdf</b></td><td>このマニュアルです</td></tr>
    <tr><td>③詳しい資料（公開・改造する人向け）.zip</td><td>普段は開かなくて大丈夫です（インターネットに公開したい・改造したい人向け）</td></tr>
  </table>
  <div class="tip"><b>Mac の種類の見分け方:</b> 画面左上の <b>りんごマーク</b> →「<b>このMacについて</b>」を開きます。「チップ」に <b>Apple M…</b> と書いてあれば <b>Appleシリコン用</b>、「プロセッサ」に <b>Intel</b> と書いてあれば <b>Intel用</b> です。</div>

  <h2>2. インストールする</h2>
  <h3>Windows の場合</h3>
  <ol>
    <li><b>①アプリ（Windows用）.exe</b> をダブルクリックします。</li>
    <li>青い画面で「<b>WindowsによってPCが保護されました</b>」と出たら、<b>「詳細情報」</b>を押し、出てきた <b class="btn">実行</b> を押します。<br>
      <span style="color:#475569;font-size:9.5pt">（個人が作ったアプリには必ず出る確認です。ウイルスという意味ではありません）</span></li>
    <li>自動でインストールされ、アプリが開きます。次からは、デスクトップの <b>「相場カード比較ボード」</b> のアイコンから開きます。</li>
  </ol>
  <h3>Mac の場合</h3>
  <ol>
    <li><b>①アプリ（Mac・…用）.dmg</b> をダブルクリックします。</li>
    <li>出てきた画面で、アプリのアイコンを <b>「Applications（アプリケーション）」フォルダ</b> へドラッグします。</li>
    <li>「アプリケーション」フォルダの <b>SobaCardBoard</b> をダブルクリックします（開くと「相場カード比較ボード」と表示されます）。</li>
    <li>「開いていません」「開発元を確認できません」と出たら <b class="btn">完了</b>（または <b class="btn">OK</b>）を押し、
      りんごマーク →「<b>システム設定</b>」→「<b>プライバシーとセキュリティ</b>」を開いて、下の方の <b class="btn">このまま開く</b> を押します。パスワードを聞かれたら、Mac のパスワードを入れます。</li>
    <li>もう一度 SobaCardBoard をダブルクリックすると開きます。2回目からは確認は出ません。</li>
  </ol>
  <div class="note">Mac で「壊れているため開けません」と出た場合は、<b>ダウンロードし直して</b>から上の手順をもう一度お試しください。それでも開かないときはご連絡ください。</div>
</section>

<section class="page">
  <h2>3. 最初の設定（キーの登録）— 1サイト5分ほど</h2>
  <p>楽天市場・Yahoo!ショッピング・eBay の商品を<b>画像つき</b>で自動表示するには、各サイトで無料の「キー」を登録して、アプリに貼り付けます。
  初めてアプリを開くと、この設定画面が自動で出ます。<b>あとからでも、画面右上の <b class="btn">設定（キーの登録）</b> でいつでも開けます。</b></p>
  ${figure(s.setupOverview, '設定の最初の画面。サイトごとに「設定する」を押して進みます。', '82%')}
  <div class="tip">メルカリ・ヤフオク・ラクマ・Amazon はキーが要りません。キーを1つも設定しなくても、右側のタブでの表示と「値段を取り込む」は使えます。</div>
</section>

<section class="page">
  <h3>楽天市場のキー</h3>
  <ol>
    <li><b class="btn">楽天の登録ページを開く</b> を押し、いつものブラウザで楽天会員にログインします。</li>
    <li>登録ページの各欄に、アプリに出ている内容を <b class="btn">コピー</b> で写して貼り付けます（「アプリケーションタイプ」は「Webアプリケーション」を選びます）。</li>
    <li>ページ下の「<b>利用情報</b>」では、「データ使用目的」にアプリの文を貼り、「必要とされるQPS」には <b>1</b> を入れます。
      「<b>APIアクセススコープ</b>」は <b>「楽天市場API」だけ</b>にチェックを入れます（トラベル・ブックスなど、ほかは入れません）。</li>
    <li>登録後に出る「アプリケーションID」と「アクセスキー」をアプリに貼り、<b class="btn">保存してテスト</b> を押します。</li>
    <li>「<b>使えます</b>」と出たら完了です。うまくいかないときは、出てきた文のとおりに直してもう一度押します。</li>
  </ol>
  <div class="two">
    ${figure(s.setupRakutenTop, '登録ページに写す内容。「コピー」を押して貼り付けるだけです。')}
    ${figure(s.setupRakutenBottom, 'キーを貼って「保存してテスト」。「使えます」と出れば完了。')}
  </div>
  <h3>Yahoo!ショッピング・eBay のキー</h3>
  <p>同じように、設定画面の「Yahoo!ショッピング」「eBay（任意）」の手順どおりに進めます。eBay は海外の相場を見たい人だけで大丈夫です（登録の承認に1営業日ほどかかります）。</p>
  ${figure(s.setupDone, '設定済みのサイトには「設定済み」と出ます。', '70%')}
  <div class="note">キーはこのパソコンの中だけに暗号化して保存され、ほかの人やインターネットには送られません。楽天のアプリには約1年の有効期限があり、期限が近づくとアプリの上部でお知らせします。</div>
</section>

<section class="page">
  <h2>4. 探す（ボタン1つ）</h2>
  ${figure(s.searched, '「まとめて探す」を押したところ。番号は下の説明と対応しています。')}
  <table>
    <tr><th style="width:12mm">番号</th><th>場所</th><th>すること・分かること</th></tr>
    <tr><td><span class="num">1</span></td><td>検索欄</td><td>商品名・型番・JANコードを入れます。</td></tr>
    <tr><td><span class="num">2</span></td><td><b class="btn">まとめて探す</b></td><td>押すと、7つのサイトを一度に探します。</td></tr>
    <tr><td><span class="num">3</span></td><td>サイトごとの状況</td><td>どのサイトの結果が「どこに」出ているかが、1行で分かります。押すと、そのサイトの結果へ移動します。<br>
      「キーが未設定です → 押して設定する」と出たサイトは、押すとそのサイトの設定が開きます。</td></tr>
    <tr><td><span class="num">4</span></td><td><b class="btn">値段を取り込む</b></td><td>右側に開いたメルカリ・ヤフオク・ラクマ・Amazon の値段を、下の一覧に加えます（次のページ）。</td></tr>
    <tr><td><span class="num">5</span></td><td>右側のタブ</td><td>メルカリ・ヤフオク・ラクマ・Amazon の<b>本物の検索ページ</b>が開いています。タブを押して切り替え、商品を押せばその場で詳しく見られます。<br>
      「比較・利益」「保存・CSV」のタブもここにあります。</td></tr>
  </table>
</section>

<section class="page">
  <h2>5. 値段を取り込む（ボタン1つ）</h2>
  <p><b class="btn">メルカリ・ヤフオク・ラクマ・Amazon の値段を取り込む</b> を押すと、右側のタブに出ている検索結果（各サイト1ページ）から、<b>値段と商品ページへのリンクだけ</b>を読み取り、一覧に加えます。コピーや貼り付け、手入力は要りません。</p>
  <div class="two">
    ${figure(s.captureNotice, 'サイトごとに何件取り込んだかが出ます。')}
    ${figure(s.summary, '一覧の上に、何がいくつ並んでいるかを文で表示します。')}
  </div>
  ${figure(s.results, '取り込んだ値段も、画像つきの商品と一緒に安い順に並びます。')}
  <div class="note">取り込みは、あなたがボタンを押したときに、表示中の1ページから値段とリンクだけを読む補助機能です（画像・説明文は読みません。ページ送りや自動巡回もしません）。各サイトの利用規約に沿ってお使いください。サイトごとに設定でオフにもできます（7章）。</div>
</section>

<section class="page">
  <h2>6. 一覧の見かた</h2>
  <div class="two">
    ${figure(s.cardApi, '楽天市場・Yahoo!・eBay の商品（画像つき・「公式API取得」）')}
    ${figure(s.cardCaptured, '取り込んだ値段（画像なし・「検索表示から推定」）')}
  </div>
  <ul>
    <li>カードの <b class="btn">元ページを見る</b> を押すと、いつものブラウザでその商品のページが開きます。<b>買う・売る前に、必ず元ページで値段・送料・状態を確かめてください。</b></li>
    <li><b class="btn">比較に追加</b> を押すと、右側の「比較・利益」タブに集まります。</li>
    <li>「相場より大幅に安い（付属品等の可能性）」と出たものは、ケースや部品など本体ではない可能性があります。</li>
  </ul>
  <h3>相場一覧（サイトごとの値段の幅）</h3>
  ${figure(s.overview, 'サイトごとの最安〜最高を同じ目盛りの横棒で並べます。白い縦線は真ん中の値段（中央値）、「最安」は一番安いサイトです。サイト名を押すと、そのサイトの商品だけを一覧に出します。')}
</section>

<section class="page">
  <h2>7. 比較・利益、保存・CSV、設定</h2>
  <div class="two">
    ${figure(s.compare, '「比較・利益」タブ。「この価格を仕入れに使う」を押し、販売価格・送料を入れると利益の見込みが出ます。')}
    ${figure(s.history, '「保存・CSV」タブ。名前を付けて保存すると、あとで同じ状態に戻せます。CSV は Excel で開けます。')}
  </div>
  ${figure(s.captureSettings, '設定画面の下の方で、サイトごとに「値段の取り込み」をオン・オフできます。', '80%')}
</section>

<section class="page">
  <h2>8. 困ったとき</h2>
  <table>
    <tr><th>こんなとき</th><th>こうしてください</th></tr>
    <tr><td>「キーが未設定です → 押して設定する」と出る</td><td>そのまま押すと、そのサイトの設定が開きます。手順どおりにキーを貼って「保存してテスト」を押します（3章）。</td></tr>
    <tr><td>設定で「キーが違うか…許可されたWebサイト…」と出る</td><td>楽天のアプリ一覧で、キーをコピーし直して貼ります。楽天の「許可されたWebサイト」に、設定画面に出ている文字がそのまま入っているか確認します。</td></tr>
    <tr><td>「値段を読み取れませんでした」と出る</td><td>右側のタブで、ログイン画面や「ロボットではありません」の確認が出ていないか見てください。出ていたら画面の案内どおりに操作し、もう一度「値段を取り込む」を押します。</td></tr>
    <tr><td>右側のタブが真っ白・開かない</td><td>タブの上の <b class="btn">↻</b>（読み込み直す）を押すか、<b class="btn">いつものブラウザで開く</b> を押します。</td></tr>
    <tr><td>0件になる</td><td>商品名を短くする、型番だけにするなど、検索語を変えてお試しください。</td></tr>
    <tr><td>「短時間に検索が集中しました」</td><td>1分ほど待ってから、もう一度探します。</td></tr>
    <tr><td>楽天の有効期限のお知らせが出た</td><td>お知らせの <b class="btn">楽天のアプリ一覧を開く</b> から、有効期限を延長します。</td></tr>
    <tr><td>アプリが開かない（Mac）</td><td>2章の「システム設定 → プライバシーとセキュリティ → このまま開く」を行います。</td></tr>
    <tr><td>アプリを消したい</td><td>Windows:「設定」→「アプリ」から「相場カード比較ボード」をアンインストール。Mac:「アプリケーション」の SobaCardBoard をゴミ箱へ。</td></tr>
  </table>
  <h3>大切なこと</h3>
  <ul>
    <li>表示される値段は、探したときの参考です。最新の値段・送料・在庫・状態は、必ず元ページで確かめてください。</li>
    <li>利益計算に、消費税・関税・取引ごとの固定手数料は含まれません。</li>
    <li>保存したデータ・キーは、このパソコンの中だけにあります。</li>
  </ul>
</section>

</body></html>`;
}
