# バイヤー向け引き渡しガイド

このドキュメントは、ツールを受け取ったバイヤーが自分でセットアップ・運用できるよう説明したものです。

---

## 受け取るもの

| ファイル/フォルダ | 内容 |
|------------------|------|
| `src/` | アプリのソースコード（React + TypeScript） |
| `docs/` | 各種説明文書 |
| `public/` | 静的アセット（追加している場合のみ） |
| `package.json` | 依存パッケージ一覧 |
| `.nvmrc` | 推奨 Node.js バージョン（20） |
| `README.md` | 起動・概要説明 |
| `.env.example` | 環境変数サンプル |

---

## 動かすための手順

### 1. Node.js のインストール確認

ターミナルで確認します:

```bash
node -v
```

`v20.x.x` 以上が表示されれば OK です。なければ https://nodejs.org からインストールしてください。

### 2. パッケージのインストール

```bash
npm install
```

v0.1 Demo は API キー不要で、この時点では追加設定なしで起動できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

### 4. ビルド（公開用）

```bash
npm run build
```

`dist/` フォルダが生成されます。このフォルダをホスティングサービスにアップロードすることで公開できます。

---

## デプロイ方法

デプロイ先の詳細は `docs/deployment-guide.md` を参照してください。

**Cloudflare Pages（推奨）:**
1. GitHub リポジトリに push
2. Cloudflare Pages でリポジトリを連携
3. ビルドコマンド: `npm run build`、出力ディレクトリ: `dist`

**Vercel:**
1. GitHub リポジトリに push
2. Vercel でインポート
3. 自動検出で設定完了

---

## カスタマイズ方法

### アプリ名を変える

`src/components/AppShell.tsx` の以下の箇所を変更します:

```tsx
<h1 className="text-2xl font-bold tracking-tight md:text-3xl">
  Coconala Tool  ← ここを変更
</h1>
```

### テーマの初期設定を変える

`src/store/researchStore.ts` の以下の箇所を変更します:

```ts
theme: 'simple-pro',  ← 'soft-market' | 'dark-trader' | 'natural-board' に変更可能
```

### サンプルデータを変える

`src/data/sampleMarketCards.ts` を編集してください。

---

## よくある質問

**Q: 価格は自動で取得されますか？**  
A: v0.1 Demo はサンプルデータと楽天APIモックで動作します。実マーケットプレイスのリアルタイム取得は未接続で、公式API接続（楽天市場等）は別フェーズです。詳しくは `docs/first-official-api-plan.md` を参照してください。

**Q: APIキーはどこに入れますか？**  
A: v0.1 Demo では API キーは不要です。将来の実API接続時も、フロントエンドには入れず Cloudflare Workers や Vercel Edge Functions などのサーバーサイドに環境変数として設定します。

**Q: データはどこに保存されますか？**  
A: ブラウザのローカルストレージに保存されます。サーバーへの送信はありません。

**Q: スクレイピングはしますか？**  
A: していません。検索リンク生成（ユーザーが手動でページを開く）と公式APIのみを使用します。

---

## サポート範囲

納品後のサポート期間はプランにより異なります（`docs/coconala-listing-copy.md` 参照）。

実API接続（楽天など）は v0.1 の納品範囲外です。必要な場合は次フェーズの有償カスタマイズとして切り分けて案内してください。

サポート対象:
- ビルド・起動に関するエラー
- 本ツール固有のバグ

サポート対象外:
- ブラウザ・OS の設定問題
- API キーの取得・申請手続き
- カスタマイズ要件（別途見積もり）
