# デプロイガイド

このドキュメントでは、相場カードリサーチアプリをホスティングサービスへデプロイする方法を説明します。

---

## ビルドコマンドと出力ディレクトリ

| 項目 | 値 |
|------|-----|
| ビルドコマンド | `npm run build` |
| 出力ディレクトリ | `dist` |
| 推奨 Node バージョン | 20.x（`.nvmrc` 参照） |

---

## 環境変数ポリシー

- フロントエンドコードに APIキー・シークレットを直接書かない
- 将来的に公式 API を呼び出す場合は、Cloudflare Workers / Vercel Edge Functions 等のサーバーサイドに環境変数として設定する
- `VITE_` プレフィックスの環境変数はビルド時にバンドルに含まれるため、シークレットには使用しない

現在のデモ版では、環境変数の設定は不要です（`.env.example` を参照）。

---

## Cloudflare Pages へのデプロイ

### 手順

1. [Cloudflare Pages](https://pages.cloudflare.com/) にログインします
2. 「Create a project」→「Connect to Git」で GitHub リポジトリを連携します
3. ビルド設定を以下の通り入力します：
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: `20`（Environment variables に `NODE_VERSION=20` を設定）
4. 「Save and Deploy」をクリックします
5. デプロイ完了後、発行された `*.pages.dev` URL でアプリが利用できます

### メリット

- 無料枠が大きい（月 500 ビルド、帯域無制限）
- Cloudflare Workers との連携が容易（将来の API サーバー化に向いている）

---

## Vercel へのデプロイ

### 手順

1. [Vercel](https://vercel.com/) にログインします
2. 「Add New Project」で GitHub リポジトリをインポートします
3. フレームワークが「Vite」として自動検出されることを確認します
4. ビルド設定を確認します：
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. 「Deploy」をクリックします
6. デプロイ完了後、発行された `*.vercel.app` URL でアプリが利用できます

### メリット

- Hobby プランは無料
- Next.js への移行が容易（将来の SSR 対応に向いている）
- Vercel Edge Functions でサーバーサイド処理を追加できる

---

## GitHub Pages へのデプロイ

### 注意事項

- GitHub Pages はサブパス（例: `username.github.io/coconala-tool/`）でホストする場合、`vite.config.ts` の `base` オプションを設定する必要があります
- ルートドメイン対応は `CNAME` ファイルで可能

### 手順

1. `vite.config.ts` に `base` を追加します（サブパスの場合）：

   ```ts
   export default defineConfig({
     base: '/coconala-tool/',
     plugins: [react()],
   });
   ```

2. GitHub Actions ワークフローを追加します（`.github/workflows/deploy.yml`）：

   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v4
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

3. リポジトリの Settings → Pages → Source を「gh-pages ブランチ」に設定します

---

## デプロイ後の確認

- [ ] アプリが正常に表示される
- [ ] テーマ切替が動作する
- [ ] ローカルストレージが正常に動作する（履歴の保存・再開）
- [ ] CSV エクスポートが動作する
- [ ] 外部リンクが正しく開く

---

## カスタムドメインの設定（オプション）

Cloudflare Pages / Vercel ともにカスタムドメインを無料で設定できます。
各サービスのダッシュボードから「Custom Domain」を追加し、DNS レコード（CNAME）を設定してください。
