# セットアップガイド（ローカル実行）

## 前提

- Node.js 20 LTS（テスト済みの基準。22 でも動作しますが基準は 20 LTS）
- npm が利用可能

## 手順

```bash
npm ci      # lockfile に固定されたバージョンを再現インストール
npm run dev
```

> 初回や lockfile を更新したい場合のみ `npm install` を使ってください。日常の再現インストールは `npm ci` が基準です。

ブラウザで表示されたローカルURLを開くと利用できます。

## 品質チェック

```bash
npm run lint   # 型チェック（tsc -b）
npm run build
npm run test   # profitCalculator / csvExport の回帰テスト（Vitest）
```

## データソースについて

- 既定はサンプルデータと「楽天API想定モック」で、検索・比較・利益計算・CSV出力・履歴保存の主要フローを確認できます。
- 各カードには `サンプルデータ` / `モック（楽天API想定）` のバッジと、`公式API取得` / `検索表示から推定` / `検索リンク` / `手動追加` のソースラベルを表示します。
- 検索表示由来の価格は「推定」です。実価格は元ページで確認してください。

## 楽天 商品検索API（実データ）を試す

App ID は **絶対にフロントエンド（`VITE_`）に置きません**。Cloudflare Pages Functions
（`functions/api/rakuten.ts`）でサーバー側プロキシを立て、そこから楽天APIを呼びます。

1. 楽天ウェブサービスで Application ID を取得します。
2. ローカルでは `.dev.vars`（Cloudflare 用）に設定します。

   ```
   SERVER_RAKUTEN_APP_ID=あなたのアプリID
   ```

3. Functions を起動し、フロントを同時に動かします。

   ```bash
   npm run build
   npx wrangler pages dev dist --port 8788
   # 別ターミナルで
   npm run dev
   ```

   `npm run dev`（Vite）は `/api/*` を `http://127.0.0.1:8788`（Functions）へプロキシします。

4. データソースを「楽天市場」に切り替えて検索すると、キー設定時は `公式API取得`
   ラベルの実データが表示されます。

### フォールバック挙動（重要）

- キー未設定・ネットワーク失敗・レート超過のいずれの場合も、アプリは落ちません。
- 自動で「公式API想定モック」にフォールバックし、警告メッセージを添えて表示します。
- ビルド成果物（フロント）にキー文字列は含まれません（`grep -r "SERVER_RAKUTEN" dist/` で何も出ません）。

## なぜメルカリ・ヤフオクは検索リンク中心か

安全性と規約配慮を優先し、メルカリ・ヤフオクは検索リンク生成と手動追加を中心にしています。
高頻度自動スクレイピングは実装しません。
