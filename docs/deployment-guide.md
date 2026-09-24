# 公開（デプロイ）ガイド

相場カード比較ボードをインターネットに公開する手順です。公開方法は2つあります。

| 公開方法 | 楽天市場の実データ | 必要なもの | 向いている人 |
|---|---|---|---|
| **Workers 版（推奨・正式対応）** | ✅ 使える | Cloudflare アカウント、Node.js 22、楽天のアプリID・アクセスキー | 実際のリサーチに使う |
| **かんたん公開（静的版 `app-static/`）** | ❌ 見本データのみ | Cloudflare などのアカウントだけ | まず試したい・楽天以外で使う |

どちらでも、サンプルデータ・手動追加・比較・利益計算・CSV・履歴はすべて使えます。

---

## Workers 版で公開（楽天の実データあり・推奨）

Cloudflare Workers に、画面と「楽天へ問い合わせる小さなサーバー（`/api/rakuten`）」を一緒に公開します。
楽天のキーはこのサーバー側だけに置くので、画面を見た人にキーが漏れることはありません。

### 1. 準備

- [Cloudflare](https://dash.cloudflare.com/sign-up) のアカウント（無料プランで動きます）
- [Node.js 22](https://nodejs.org/) をパソコンにインストール
- 納品物の `source/` フォルダでターミナル（コマンドプロンプト）を開き、次を実行します。

```bash
npm ci
```

### 2. Cloudflare にログインして公開する

```bash
npx wrangler login
npm run deploy
```

ブラウザが開いたら Cloudflare にログインして許可します。完了すると
`https://coconala-tool.<あなたのサブドメイン>.workers.dev` のような URL が表示されます。これが公開URLです。

- 名前を変えたいときは `wrangler.jsonc` の `"name"` を変えてから `npm run deploy` します。
- この時点では楽天のキーが無いため、楽天市場モードは「見本データ（楽天連携の設定前）」と表示されます。

### 3. 楽天のアプリID・アクセスキーを取得する

楽天の仕組みは 2026 年に新しくなり、**アプリID とアクセスキーの両方**が必要です（旧方式のアプリIDだけでは動きません）。

1. [楽天ウェブサービス](https://webservice.rakuten.co.jp/) に楽天会員でログインし、「アプリID発行」から新しいアプリを登録します。
2. 登録画面の「許可されたWebサイト」（またはアプリのURL）に、手順2で表示された公開URLのドメイン
   （例: `coconala-tool.xxxx.workers.dev`）を入力します。
3. 登録後の画面で「アプリケーションID」と「アクセスキー」を控えます。

### 4. キーを Cloudflare に登録する（秘密の値として保存）

```bash
npx wrangler secret put SERVER_RAKUTEN_APP_ID
npx wrangler secret put SERVER_RAKUTEN_ACCESS_KEY
```

それぞれ実行すると値の入力を求められるので、控えた値を貼り付けて Enter を押します。
入力した値は画面や納品物には残りません。ダッシュボードの「Workers & Pages → coconala-tool → 設定 → 変数とシークレット」からも登録できます。

独自ドメインで公開していて、楽天に登録したサイトと公開URLが違う場合だけ、次も登録します（例: `https://shop.example.com`）。

```bash
npx wrangler secret put SERVER_RAKUTEN_ALLOWED_ORIGIN
```

### 5. 確認する

公開URLを開き、データソースを「楽天市場」にして商品名を検索します。
ヘッダーが緑色の「実データ表示中 — 楽天市場」になり、カードに「公式API取得」と表示されれば完了です。

自動チェックも実行できます（初回だけブラウザの準備が必要です）。

```bash
npx playwright install chromium
E2E_BASE_URL=https://coconala-tool.xxxx.workers.dev npm run e2e:postdeploy
```

すべて `passed` になれば、画面表示・検索・比較・履歴・セキュリティ設定が公開環境でも正しく動いています。
確認内容の一覧は [`post-deploy-qa.md`](post-deploy-qa.md) にあります。

### GitHub と連携して自動公開する（任意）

Cloudflare ダッシュボードの「Workers & Pages → 作成 → Git リポジトリをインポート」から連携できます。

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Worker 名は `wrangler.jsonc` の `"name"`（既定 `coconala-tool`）と同じにします。
- キーは手順4と同じく「変数とシークレット」に登録します。

---

## かんたん公開（楽天の実データなし）

納品物の `app-static/` は、ビルド済みの完成品です。Node.js もコマンドも不要です。

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) で「Workers & Pages → 作成 → Pages → アセットをアップロード（直接アップロード）」を選びます。
2. プロジェクト名を入力し、`app-static` フォルダの**中身**をドラッグ＆ドロップして「デプロイ」します。
3. 表示された `https://<プロジェクト名>.pages.dev` を開けば完了です。

- 楽天市場モードを選ぶと「この公開版は楽天市場との連携なしで動作しています」と表示され、見本データになります。
- セキュリティ設定（`_headers`）も一緒に反映されます。
- Netlify（Netlify Drop）など、静的ファイルを置けるサービスでも同じフォルダで公開できます。
- Vercel や GitHub Pages で楽天の実データを使うには、別途サーバー機能の開発が必要です（標準の対象外）。

---

## 安全のための仕組み（設定不要）

- 楽天のキーはサーバー側（Workers のシークレット）にだけ保存され、画面・ブラウザ・納品物には含まれません。
- `/api/rakuten` は、他のサイトの画面から呼び出されると 403 で拒否します（プログラムからの直接呼び出しは、下のレート制限で抑えます）。
- 1人（IPアドレス）あたり 60 秒に 30 回を超える検索は一時的に止めます（`wrangler.jsonc` の `ratelimits`）。
  楽天の利用上限を守るための仕組みで、回数は `"limit"` で変更できます。
- 画面には、他サイトへの埋め込み禁止・読み込み元の制限などのセキュリティヘッダーが付きます（`public/_headers`）。
- 楽天の応答は約8秒でタイムアウトし、失敗しても画面は落ちずに理由を表示して見本データに切り替えます。

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| 「楽天市場との連携がまだ設定されていない」と出る | キーが未登録。手順4で **2つとも** 登録し、数十秒待って再検索 |
| 「楽天市場の設定（アプリID・アクセスキー・許可サイト）が正しくない」と出る | キーの貼り間違い、または楽天の「許可されたWebサイト」と公開URLの不一致。独自ドメインなら `SERVER_RAKUTEN_ALLOWED_ORIGIN` も登録 |
| 「短時間に検索が集中した」と出る | 1分ほど待つ。利用者が多いなら `wrangler.jsonc` の `"limit"` を増やして再公開 |
| `npm run deploy` で `wrangler login` を求められる | 手順2の `npx wrangler login` を先に実行 |
| GitHub 連携の自動ビルドがすぐ失敗する | ダッシュボードの Build の API トークンが古い可能性。[Cloudflare の案内](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/) に従って作り直し、Retry |
| Node.js のバージョンエラー | Node.js 22 を使う（`.nvmrc`）。ダッシュボードの `NODE_VERSION` が 20 なら 22 に変更 |

## 開発者向けメモ

- ビルド: `npm run build`（`dist/client` に画面、`dist/coconala_tool` に Worker）
- 静的版ビルド: `npm run build:static`（`dist-static/client`）
- `/api/rakuten` の仕様: `GET /api/rakuten?q=<検索語>&limit=<1〜30>`。GET 以外は 405、検索語が不正なら 400 `invalid_query`、
  キー未設定は 503 `no_key`、楽天側の認証・許可サイトエラーは 502 `upstream_auth`、429 `rate_limited`、
  5xx は 502 `upstream_error`、応答形式の不正は 502 `invalid_json`、タイムアウトは 504 `timeout`。
  楽天の「該当なし（404）」は 0件の正常応答として返します。応答はキャッシュしません（`cache-control: no-store`）。
- `wrangler.jsonc` の `env.e2e` は自動テスト専用です（本番の `npm run deploy` には含まれません）。
