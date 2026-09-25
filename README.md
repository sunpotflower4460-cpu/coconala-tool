# 相場カード比較ボード / Market Card Board

物販・せどり向けの相場リサーチ補助ツールです。楽天市場・Yahoo!ショッピング・eBay の公式APIで価格候補をまとめて検索し、
メルカリ・ヤフオク等で見た価格も含めてサイト別の価格帯を一目で比較、利益見込み・履歴・CSV出力までまとめて管理できます。

現在のバージョン: **v0.9.0-rc.14**（正式販売前の候補版）

- 購入者の方は、まず [`docs/README_FIRST.md`](docs/README_FIRST.md)（納品ZIPでは `README_FIRST.md`）をお読みください。
- 公開手順: [`docs/deployment-guide.md`](docs/deployment-guide.md) / ローカル起動: [`docs/setup-guide.md`](docs/setup-guide.md)

## 対応データソース（誇張なし）

| ソース | 状態 | 説明 |
|---|---|---|
| 楽天市場 商品検索API（2026-07-01版） | ✅ 公式API対応 | `SERVER_RAKUTEN_APP_ID` と `SERVER_RAKUTEN_ACCESS_KEY` |
| Yahoo!ショッピング 商品検索API（v3） | ✅ 公式API対応 | `SERVER_YAHOO_CLIENT_ID` |
| eBay Browse API | ✅ 公式API対応（USD を円換算） | `SERVER_EBAY_CLIENT_ID` と `SERVER_EBAY_CLIENT_SECRET` |
| メルカリ・ヤフオク・ラクマ・Amazon | 検索リンク＋価格の手入力 | 公式の検索APIが無い（または利用条件がある）ため自動取得しません。「まとめて開く（画面分割）」で見た価格を相場一覧に入力します |
| サンプルデータ | デモ用 | 操作確認用の固定データ（PS5 関連） |
| 見本データ（楽天想定） | デモ用 | 楽天の設定前・接続できない時に、理由を表示したうえで表示する実在しない商品 |

「全サイト完全自動取得」「最安値保証」のような機能はありません。表示価格は元ページでの確認を前提とした参考値です。

## 公開方法ごとの対応範囲

| 公開方法 | 画面 | 楽天の実データ |
|---|---|---|
| Cloudflare Workers（推奨・正式対応。`npm run deploy`） | ✅ | ✅（楽天・Yahoo!・eBay） |
| 静的版 `app-static/`（Cloudflare Pages 直接アップロード・Netlify 等） | ✅ | ❌ 見本データのみ |

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
```

<!-- repo-only:start -->
### 販売者向けコマンド（開発リポジトリのみ）

```bash
npm run verify:all        # 型・単体・ビルド・E2E・整合チェック・納品ZIP生成・ZIP展開後の再ビルドまで一括実行
npm run verify:release    # バージョン・リンク・誇張表現・秘密情報・セキュリティヘッダーの整合チェック
npm run delivery:package  # 納品ZIPを dist-delivery/ に生成
npm run delivery:verify   # 生成したZIPを展開して中身・リンク・ビルド・静的版の動作を検証
npm run marketing:capture # 出品用のスクリーンショットと操作動画の下書きを dist-delivery/marketing/ に生成
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
楽天に接続できず見本データへ切り替えた場合も、その事実と理由を画面に表示します。

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
