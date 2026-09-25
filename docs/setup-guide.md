# セットアップガイド（自分のパソコンで動かす）

## 前提

- Node.js 22（`.nvmrc` 参照）
- 納品物の `source/` フォルダ（開発リポジトリではリポジトリ直下）でターミナルを開きます

## 起動

```bash
npm ci        # 同梱の package-lock.json と同じバージョンを再現インストール
npm run dev   # 表示された http://localhost:5173 をブラウザで開く
```

楽天のキーが無くても、価格の貼り付け・手入力で比較・利益計算・CSV・履歴を使えます。

## デスクトップアプリを動かす・作る

```bash
npm run desktop            # ビルドしてデスクトップアプリを起動（キーはアプリの「設定」から登録）
npm run dist:desktop:mac   # Mac 用インストーラー（release-desktop/*.dmg。Mac で実行）
npm run dist:desktop:win   # Windows 用インストーラー（release-desktop/*.exe）
npm run e2e:desktop        # デスクトップアプリの自動操作テスト（先に npm run build:desktop）
```

- アプリ本体は `electron/`、画面は Web 版と同じ `src/`（`src/features/desktop/` がデスクトップ版の画面）です。
- `/api/rakuten` などは Web 版と同じ `worker.ts` をアプリ本体の中で動かし、キーはアプリの「設定」で保存したものを使います。
- 楽天に名乗るサイト（「許可されたWebサイト」に登録するURL）は `src/lib/desktopConfig.ts` の `DESKTOP_RAKUTEN_ALLOWED_ORIGIN` です。

## Web 版で楽天・Yahoo!・eBay の実データを手元で試す

楽天のキーは **画面側（`VITE_` で始まる変数）には絶対に置きません**。サーバー側（`/api/rakuten`）だけが読みます。

1. [`deployment-guide.md` の手順3](deployment-guide.md#3-楽天のアプリidアクセスキーを取得する) で、アプリIDとアクセスキーを取得します。
2. `source/` 直下に `.dev.vars` というファイルを作り、次のように書きます（このファイルは納品物・Git に含まれません）。
   楽天の「許可されたWebサイト」には `localhost` を登録できないため、手元でも楽天に登録した公開ドメインを名乗って問い合わせます。

   ```
   SERVER_RAKUTEN_APP_ID=あなたのアプリID
   SERVER_RAKUTEN_ACCESS_KEY=あなたのアクセスキー
   SERVER_RAKUTEN_ALLOWED_ORIGIN=https://楽天に登録した公開ドメイン
   SERVER_YAHOO_CLIENT_ID=あなたのYahoo! Client ID（任意）
   SERVER_EBAY_CLIENT_ID=あなたのeBay App ID（任意）
   SERVER_EBAY_CLIENT_SECRET=あなたのeBay Cert ID（任意）
   ```

3. `npm run dev` を起動し直し、データソースを「まとめて（楽天・Yahoo!・eBay）」にして検索します。
   `npm run dev` は Cloudflare の仕組みで Worker（`/api/rakuten`）も同時に動かすため、別のサーバーを起動する必要はありません。

キーが無い・間違っている・楽天に接続できない場合も画面は落ちず、理由を表示します（実在しない商品は表示しません）。

## 品質チェック（改造したとき）

```bash
npm run lint    # 型チェック
npm test        # 単体・画面部品テスト（Vitest）
npm run build   # 本番用ビルド
npx playwright install chromium webkit   # 初回のみ
npm run e2e     # ブラウザでの自動操作テスト（偽の楽天APIと本番同等の Worker を自動起動）
```

`npm run e2e` は PC・タブレット・スマホ（Chromium と iPhone 相当の WebKit）の画面幅で、検索・比較・利益計算・
手動追加・CSV・履歴・テーマ・アクセシビリティ・楽天の各種障害時の表示をまとめて確認します。

## データの種類について

- 各カードには出どころ（`公式API取得` / `検索表示から推定` / `検索リンク` / `手動追加`）が必ず表示されます。
- 接続できないときも実在しない商品（見本・サンプル）は表示しません。理由と、貼り付け・入力で並べる方法を表示します。
- 検索表示由来の価格は「推定」です。実際の価格は元ページで確認してください。

## メルカリ・ヤフオクが検索リンク中心の理由

各サイトの規約と安全性を優先し、自動での大量取得（スクレイピング）は行いません。
検索リンクから各サイトを開いて確認し、気になった商品は「手動で追加」で比較に入れる使い方です。
