# 正式販売リリースチェックリスト（v1.0.0 に向けて）

現在のバージョン（`package.json` / README 参照）は正式販売前の候補版（`0.9.0-rc.x`）です。このチェックリストをすべて満たしてから `v1.0.0` タグ付けと正式販売を行ってください。

## 現在の対応範囲（誇張なし）

- [ ] 楽天市場 商品検索APIのみ公式API対応（Cloudflare Pages Functions、`SERVER_RAKUTEN_APP_ID` 設定時）
- [ ] メルカリ・ヤフオク・eBay・Yahoo!ショッピング等は検索リンク＋手動追加のみ（自動取得は行わない）
- [ ] サンプルデータ・モック（楽天API想定）はデモ用であることが画面上で常に分かる
- [ ] APIキー未設定・通信失敗・上流エラー・タイムアウト時に、理由が画面へ表示される（モックへフォールバックした事実を隠さない）
- [ ] デプロイ先ごとの対応範囲（Cloudflare Pages=正式対応 / Vercel=静的UIのみ / GitHub Pages=静的デモのみ）がREADME・デプロイガイドで一致している

## 表現の整合性

- [ ] README・販売文・既知の制限・画面表示のあいだに矛盾がない
- [ ] バージョン番号がアプリ（`package.json`）・README・CHANGELOG・販売文で一致する
- [ ] 「全サイト完全自動取得」「自動最安値」「完全自動」等の誇張表現がどこにもない
- [ ] 未実装の eBay / Yahoo!ショッピング API が、プラン表・納品物スコープに含まれていない（将来計画または追加見積りとしてのみ記載）
- [ ] `docs/coconala-listing-copy.md` の価格・プラン内容が実装と一致している

## 安全性

- [ ] 楽天 Application ID がフロントエンドの成果物に含まれない（`grep -r "SERVER_RAKUTEN" dist/` で何も出ない）
- [ ] APIキーやシークレットがビルド成果物・リポジトリに含まれない
- [ ] 高頻度スクレイピングを行うコードが追加されていない

## QA

CIで自動実行されるもの（`.github/workflows/ci.yml`）:

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run test`（ユニット・コンポーネントテスト）
- [ ] `npm run build`
- [ ] `npm audit --audit-level=high`
- [ ] `npm run e2e`（Playwright: サンプル検索・比較追加・利益反映・手動追加・履歴保存/再開・CSV出力・375px横スクロールなし）

人間が実環境で確認するもの:

- [ ] Cloudflare Pages のプレビュー環境で手動QA（`docs/post-deploy-qa.md` に沿って実施）
- [ ] 幅 375px / 768px / 1280px で崩れがないことを確認（実機・実ブラウザ）
- [ ] 実楽天APIで複数の検索語を確認（PS5・Nintendo Switch・型番・JANコード・0件になる語 等）

## 販売物

- [ ] 利用規約・免責・サポート範囲・返金/キャンセルの扱いが確定している（`TERMS.md` / `docs/SUPPORT_POLICY.md`）
- [ ] 購入者向けクイックスタートがある（`docs/QUICK_START_BUYER.md`）
- [ ] データの扱いについての説明がある（`docs/PRIVACY_AND_DATA.md`）
- [ ] `npm run delivery:package` で納品ZIPが生成できる（`docs/DELIVERY_CONTENTS.md` 参照）。事前チェック（バージョン一致・シークレット混入なし等）に失敗しないことを確認する
- [ ] デモURL、PC/スマホ画面のスクリーンショットがある
- [ ] 主要フローを見せる短い操作動画がある

## 人間の最終判断

以下は Claude Code が自動で完了扱いしない項目です。詳細は [`docs/MANUAL_STEPS_SALES.md`](MANUAL_STEPS_SALES.md) を参照してください。

- [ ] 実APIによる検索結果の目視確認
- [ ] スマホ実機確認
- [ ] 操作動画の収録・商品画像の作成
- [ ] 価格・返金/キャンセル方針・規約の最終確認
- [ ] 正式販売開始の判断
