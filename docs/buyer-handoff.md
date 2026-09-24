# 引き渡しガイド（改造・運用する方向け）

ツールを受け取った方が、自分で運用・改造できるようにするための説明です。
公開手順は [`deployment-guide.md`](deployment-guide.md)、ローカルでの起動は [`setup-guide.md`](setup-guide.md) を参照してください。

## ソースコードの構成（`source/`）

| ファイル / フォルダ | 内容 |
|---|---|
| `src/` | 画面のソースコード（React + TypeScript） |
| `functions/api/rakuten.ts` | 楽天へ問い合わせるサーバー処理（キーの保管・検証・エラー分類） |
| `worker.ts` / `wrangler.jsonc` | Cloudflare Workers の入口と設定（`/api/*` だけ Worker が処理、レート制限） |
| `public/` | そのまま配信するファイル（セキュリティヘッダー `_headers`、アイコン等） |
| `e2e/` | ブラウザ自動テスト（偽の楽天API `e2e/fake-rakuten/` を含む） |
| `docs/` | 説明文書 |
| `package.json` / `package-lock.json` | 依存パッケージ（バージョン固定。`npm ci` で再現） |
| `.nvmrc` / `.node-version` | 推奨 Node.js（22） |
| `.env.example` | 設定値の見本（実際のキーは入れない） |

## よくある改造

### アプリ名を変える

`src/components/AppShell.tsx` の `相場カード比較ボード` と、`index.html` の `<title>` を変更します。

### 初期テーマを変える

`src/store/researchStore.ts` の `theme: 'simple-pro'` を `'soft-market'` / `'dark-trader'` / `'natural-board'` に変えます。
`public/theme-init.js` の `var theme = 'simple-pro';` も同じ値にすると、初回表示のちらつきがありません。

### サンプルデータを変える

`src/data/sampleMarketCards.ts` を編集します。検索は空白区切りのすべての語を含むカードに絞り込みます。

### 楽天のレート制限を変える

`wrangler.jsonc` の `ratelimits` の `"limit"`（回数）と `"period"`（10 または 60 秒）を変えて `npm run deploy` します。

## 改造したら確認すること

```bash
npm run lint && npm test && npm run build && npm run e2e
```

すべて成功すれば、検索・比較・利益計算・手動追加・CSV・履歴・テーマ・アクセシビリティ・楽天の障害時表示が
PC・タブレット・スマホ幅で壊れていないことを確認できます。

## よくある質問

**Q: 価格は自動で取得されますか？**
A: 楽天市場のみ、公式な仕組み（API）で自動取得します（Workers 版で公開し、アプリID・アクセスキーを設定した場合）。
それ以外のサイトは検索リンクと手動追加です。

**Q: APIキーはどこに入れますか？**
A: Cloudflare Workers のシークレット（`npx wrangler secret put ...`）に入れます。手元での確認は `.dev.vars` です。
`VITE_` で始まる変数や `src/` の中には絶対に書かないでください（画面を見た人に見えてしまいます）。

**Q: データはどこに保存されますか？**
A: 利用者のブラウザ内（localStorage）です。サーバーには送りません（[`PRIVACY_AND_DATA.md`](PRIVACY_AND_DATA.md)）。

**Q: スクレイピングはしますか？**
A: しません。楽天の公式APIと、利用者が自分で開く検索リンクだけを使います。

## サポート

範囲と期間は [`SUPPORT_POLICY.md`](SUPPORT_POLICY.md) を参照してください。
