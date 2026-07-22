# Archive

このフォルダには、現在の実装・現在の販売プランと矛盾するため参照用として退避した過去のドキュメントを置いています。**現行の仕様としては扱わないでください。** 最新の情報は `docs/` 直下および README を参照してください。

## 実装前提が古くなった設計・準備ドキュメント

楽天市場 商品検索APIは `functions/api/rakuten.ts` としてすでに実装済みです。以下は「まだ実装していない」前提で書かれた計画書のため、現状と矛盾します。

- `first-official-api-plan.md` — 最初の公式API接続の設計案（実装前に書かれたもの）
- `rakuten-worker-scaffold.md` — 楽天Worker足場の設計案（実装前に書かれたもの）
- `live-rakuten-api-gate.md` — 楽天API本接続前の承認ゲート（すでに実装・承認済みのため役目を終えた）
- `api-connection-plan.md` — API接続の初期方針メモ
- `next-cloud-agent-instructions.md` — 次フェーズ向けの旧・作業指示

## 価格・プランが現行と競合する旧ドキュメント

- `coconala-package-plan.md` — 旧プラン表（Standardに未実装のeBay/Yahoo APIアダプタを含めていた等、現行の [`../coconala-listing-copy.md`](../coconala-listing-copy.md) と価格・内容が競合するため退避）

## 旧バージョンのリリース記録

- `release-v0.1-checklist.md` — v0.1 Demo 向けのリリースチェックリスト（現行は [`../release-v1-checklist.md`](../release-v1-checklist.md)）
- `release-notes-v0.1.md` — v0.1 Demo のリリースノート（履歴として保持）
- `delivery-checklist.md` — 旧・納品チェックリスト（現行は [`../release-v1-checklist.md`](../release-v1-checklist.md) と [`../DELIVERY_CONTENTS.md`](../DELIVERY_CONTENTS.md)）
