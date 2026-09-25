# 相場カード比較ボード / Market Card Board

物販・せどり向けの相場リサーチ補助アプリ（Windows / Mac）です。「まとめて探す」1回で、楽天市場・Yahoo!ショッピング・eBay の商品を
公式APIで画像つきに並べ、メルカリ・ヤフオク・ラクマ・Amazon の検索結果も同じ画面の右側のタブに開きます。
「値段を取り込む」1回で、それらの値段も同じ一覧に並べ、利益見込み・履歴・CSV出力までまとめて管理できます。Web 版（Cloudflare Workers）もあります。

現在のバージョン: **v1.0.0-beta.1**（正式販売前の候補版）

- 購入者の方は、まず [`docs/README_FIRST.md`](docs/README_FIRST.md)（納品ZIPでは `README_FIRST.md`）をお読みください。
- 公開手順: [`docs/deployment-guide.md`](docs/deployment-guide.md) / ローカル起動: [`docs/setup-guide.md`](docs/setup-guide.md)

## 対応データソース（誇張なし）

| ソース | 状態 | 説明 |
|---|---|---|
| 楽天市場 商品検索API（2026-07-01版） | ✅ 公式API対応 | `SERVER_RAKUTEN_APP_ID` と `SERVER_RAKUTEN_ACCESS_KEY` |
| Yahoo!ショッピング 商品検索API（v3） | ✅ 公式API対応 | `SERVER_YAHOO_CLIENT_ID` |
| eBay Browse API | ✅ 公式API対応（USD を円換算） | `SERVER_EBAY_CLIENT_ID` と `SERVER_EBAY_CLIENT_SECRET` |
| メルカリ・ヤフオク・ラクマ・Amazon | デスクトップ版: アプリ内のタブで表示＋利用者の操作で値段を取り込み / Web 版: 検索リンク＋価格の貼り付け・手入力 | 公式の検索APIが無い（または利用条件がある）ため自動巡回はしません。取り込みは利用者が押したときに表示中の1ページから値段とリンクだけを読みます |

「全サイト完全自動取得」「最安値保証」のような機能はありません。表示価格は元ページでの確認を前提とした参考値です。

## 使い方ごとの対応範囲

| 使い方 | 画面 | 楽天・Yahoo!・eBay の実データ |
|---|---|---|
| デスクトップアプリ（推奨。`npm run dist:desktop:mac` / `:win` でインストーラー） | ✅ | ✅（利用者のキーをアプリの「設定」で登録） |
| Cloudflare Workers（推奨・正式対応。`npm run deploy`） | ✅ | ✅（楽天・Yahoo!・eBay） |
| 静的版 `app-static/`（Cloudflare Pages 直接アップロード・Netlify 等） | ✅ | ❌ 自動取得なし（価格の貼り付け・入力で比較） |

## Quick Start

Node.js 22 を使います（`.nvmrc`）。

```bash
npm ci
npm run dev          # http://localhost:5173
npm run lint         # 型チェック
npm test             # 単体・画面部品テスト（Vitest）
npm run build        # dist/client（画面）と dist/coconala_tool（Worker）
npx playwright install chromium webkit   # 初回のみ
npm run e2e          # 偽の楽天API＋本番同等の Worker で、PC/タブレット/スマホ幅の自動操作テスト
npm run desktop      # デスクトップアプリをビルドして起動
npm run e2e:desktop  # デスクトップアプリの自動操作テスト（先に npm run build:desktop）
```

<!-- repo-only:start -->
### 販売者向けコマンド（開発リポジトリのみ）

```bash
npm run verify:all        # 型・単体・ビルド・E2E（Web・デスクトップ）・マニュアル・インストーラー・納品ファイル生成と検証まで一括実行（Mac で）
npm run verify:release    # バージョン・リンク・誇張表現・秘密情報・セキュリティヘッダーの整合チェック
npm run delivery:package  # 納品ファイル（5つ）を dist-delivery/納品ファイル-v<version>/ に生成
npm run delivery:verify   # 納品ファイルを検証（サイズ・sha256・アプリの起動・③ZIPの中身・リンク・ビルド・静的版の動作）
npm run marketing:capture # デスクトップアプリを起動して、マニュアル PDF・出品用の画面写真・操作動画の下書きを生成
```

結果は `dist-delivery/VERIFICATION_REPORT.md` にまとまります。人が行う残作業は [`docs/MANUAL_STEPS_SALES.md`](docs/MANUAL_STEPS_SALES.md) です。
<!-- repo-only:end -->

## 主な機能

- 商品名・型番・JAN・URL で「まとめて探す」→ 楽天・Yahoo!・eBay の画像つき価格カード（出どころラベル付き・サイト絞り込み・安い順）
- 相場一覧: サイト別の価格帯を同じ目盛りの横棒で比較（メルカリ等は見た価格を入力）。「まとめて開く」で外部サイトを画面分割表示
- 比較ボード（ページを閉じても保持）→ 仕入れ/販売価格へワンタップ反映 → 手数料・送料込みの利益見込み
- 元ページへのリンク、外部サイトの検索ショートカット、URLからの手動追加
- CSV 出力（Excel 対応・数式無害化）、リサーチ履歴（最大20件）、4種類のテーマ

## Product Principle

完全自動スクレイピングツールではありません。公式API・検索リンク・手動追加を組み合わせて規約リスクを抑えます。
各サイトに接続できないときは、実在しない商品を代わりに出さず、理由と「貼り付け・入力で並べる方法」を画面に表示します。

## 技術構成

Vite / React / TypeScript / Tailwind CSS / Zustand / localStorage / Cloudflare Workers（`/api/rakuten`・`/api/yahoo`・`/api/ebay`）

## License / Terms

利用範囲（商用利用可・再販/再配布の制限・保証なし）は [`TERMS.md`](TERMS.md) を参照してください。
`package.json` の `"private": true` は npm へ公開しない設定で、ソースコードの利用を制限するものではありません。

## ドキュメント

### 購入者向け

- [`docs/README_FIRST.md`](docs/README_FIRST.md) / [`docs/QUICK_START_BUYER.md`](docs/QUICK_START_BUYER.md) / [`docs/user-guide.md`](docs/user-guide.md)
- [`docs/deployment-guide.md`](docs/deployment-guide.md) / [`docs/setup-guide.md`](docs/setup-guide.md) / [`docs/post-deploy-qa.md`](docs/post-deploy-qa.md)
- [`docs/buyer-handoff.md`](docs/buyer-handoff.md) / [`docs/known-limitations.md`](docs/known-limitations.md)
- [`docs/SUPPORT_POLICY.md`](docs/SUPPORT_POLICY.md) / [`docs/PRIVACY_AND_DATA.md`](docs/PRIVACY_AND_DATA.md) / [`CHANGELOG.md`](CHANGELOG.md)

<!-- repo-only:start -->
### 販売者・開発者向け（納品物には含まれません）

- [`AGENTS.md`](AGENTS.md) / [`COPILOT_INSTRUCTIONS.md`](COPILOT_INSTRUCTIONS.md)
- [`docs/MANUAL_STEPS_SALES.md`](docs/MANUAL_STEPS_SALES.md) / [`docs/release-v1-checklist.md`](docs/release-v1-checklist.md)
- [`docs/PRODUCTION_FAILURE_RISK_MATRIX.md`](docs/PRODUCTION_FAILURE_RISK_MATRIX.md) / [`docs/qa-checklist.md`](docs/qa-checklist.md) / [`docs/manual-test-script.md`](docs/manual-test-script.md)
- [`docs/coconala-listing-copy.md`](docs/coconala-listing-copy.md) / [`docs/DELIVERY_CONTENTS.md`](docs/DELIVERY_CONTENTS.md)
- [`docs/product-brief.md`](docs/product-brief.md) / [`docs/data-source-policy.md`](docs/data-source-policy.md) / [`docs/ux-principles.md`](docs/ux-principles.md) / [`docs/phase-roadmap.md`](docs/phase-roadmap.md)
- 過去の計画書・リリースノート: [`docs/archive/`](docs/archive/)
<!-- repo-only:end -->
