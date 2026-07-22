# バイヤー向け引き渡しガイド

このドキュメントは、ツールを受け取ったバイヤーが自分でセットアップ・運用できるよう説明したものです。

---

## 受け取るもの

| ファイル/フォルダ | 内容 |
|------------------|------|
| `src/` | アプリのソースコード（React + TypeScript） |
| `docs/` | 各種説明文書 |
| `public/` | 静的アセット（追加している場合のみ） |
| `package.json` | 依存パッケージ一覧（バージョン固定済み） |
| `package-lock.json` | 依存バージョンの固定（同梱必須・`npm ci` で再現） |
| `functions/` | Cloudflare Pages Functions（楽天APIプロキシ） |
| `.nvmrc` | 推奨 Node.js バージョン（20 LTS） |
| `TERMS.md` | ライセンス・利用規約（再販可否・免責） |
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
npm ci
```

`npm ci` は同梱の `package-lock.json` に固定されたバージョンをそのまま再現インストールします
（依存は固定済みで、テスト済みは Node 20 LTS 基準です）。lockfile を更新したい場合のみ
`npm install` を使ってください。API キーは不要で、この時点では追加設定なしで起動できます。

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
デプロイ後の確認は `docs/post-deploy-qa.md` を上から実施してください。

**Cloudflare Pages（推奨・楽天API正式対応）:**
1. GitHub リポジトリに push
2. Cloudflare Pages でリポジトリを連携
3. ビルドコマンド: `npm run build`、出力ディレクトリ: `dist`

**Vercel（静的UIのみ）:**
1. GitHub リポジトリに push
2. Vercel でインポート
3. 自動検出で設定完了
4. 注意: 楽天APIプロキシは Cloudflare Pages Functions 専用実装のため、Vercel では実データに切り替えられません（サンプル/モックのみ動作）。実API連携が必要な場合は Cloudflare Pages をご利用ください。

---

## カスタマイズ方法

### アプリ名を変える

`src/components/AppShell.tsx` の以下の箇所を変更します:

```tsx
<h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
  相場カード比較ボード  ← ここを変更
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

## スコープ（引き渡し時点 / v0.9.0-rc.1）

- API キーなしで動作します（サンプルデータ / 楽天APIモック）。
- 楽天市場 商品検索APIのみ、サーバー側にキーを設定すると実データに切り替わります（未設定時はモックにフォールバック）。
- すぐに使える機能: 手動追加 / CSV出力 / 履歴保存・再開（localStorage）。
- eBay / Yahoo!ショッピング等の追加公式API連携は次フェーズの有償カスタマイズです。
- メルカリ・ヤフオクは検索リンク生成と手動確認を優先する運用です。

---

## よくある質問

**Q: 価格は自動で取得されますか？**  
A: 既定ではサンプルデータと楽天APIモックで動作します。楽天市場 商品検索APIのみ、サーバー側に `SERVER_RAKUTEN_APP_ID` を設定すると `公式API取得` ラベルの実データに切り替わります（未設定・失敗時は自動でモックに戻ります）。手順は `docs/setup-guide.md` の「楽天 商品検索API（実データ）を試す」を参照してください。その他のマーケットプレイスのリアルタイム取得は対象外です。

**Q: APIキーはどこに入れますか？**  
A: フロントエンド（`VITE_` バンドル）には入れません。Cloudflare Pages Functions（`functions/api/rakuten.ts`）が読む環境変数 `SERVER_RAKUTEN_APP_ID` に、サーバー側（Cloudflare Pages の Settings > Environment variables、ローカルは `.dev.vars`）で設定します。ビルド成果物にキー文字列は含まれません。

**Q: データはどこに保存されますか？**  
A: ブラウザのローカルストレージに保存されます。サーバーへの送信はありません。

**Q: スクレイピングはしますか？**  
A: していません。検索リンク生成（ユーザーが手動でページを開く）と公式APIのみを使用します。

---

## サポート範囲

納品後のサポート期間はプランにより異なります（`docs/coconala-listing-copy.md` 参照）。

楽天市場 商品検索APIはサーバー側キー設定で利用できます（本体に同梱）。eBay / Yahoo!ショッピング等の追加API連携は次フェーズの有償カスタマイズとして切り分けて案内してください。

サポート対象:
- ビルド・起動に関するエラー
- 本ツール固有のバグ

サポート対象外:
- ブラウザ・OS の設定問題
- API キーの取得・申請手続き
- カスタマイズ要件（別途見積もり）
