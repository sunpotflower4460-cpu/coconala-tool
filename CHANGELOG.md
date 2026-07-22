# CHANGELOG

## v0.9.0-rc.1 — 商品表現・バージョン・文書の整合（PR-1）

正式販売化に向けた最初のPR。実装は変更せず、表現・バージョン・ドキュメントの矛盾を解消した。

- 商品名を仮称から確定: 「相場カード比較ボード / Market Card Board」（`AppShell.tsx` h1 / `index.html` title / README / TERMS.md 等）
- 古い `v0.1 Demo` 表記をREADME・デプロイガイド・デプロイ後QA・ユーザーガイドから撤去し、実際のUI表示（ヘッダー常時「デモ表示中」バッジ）に合わせて記述を統一
- READMEに「対応データソース」表（楽天=公式API対応／他サイト=検索リンク＋手動追加／サンプル・モック=デモ用）と「デプロイ先ごとの対応範囲」表（Cloudflare Pages=正式対応、Vercel=静的UIのみ、GitHub Pages=静的デモのみ）を新設
- README冒頭を「購入者向け」「開発者向け」に分離
- `docs/coconala-listing-copy.md` のプラン表を整理: 楽天API接続をスタンダードプランへ、未実装の Yahoo!ショッピングAPI 連携をプレミアムプランの内容から削除（追加見積り扱いのみに統一）
- `docs/product-brief.md` の一行説明を実装に合わせて修正（eBay/Yahoo/メルカリ横断自動取得を示唆する表現を削除）
- 実装済みの楽天APIプロキシ（`functions/api/rakuten.ts`）と矛盾する接続前提のドキュメント（`live-rakuten-api-gate.md` / `first-official-api-plan.md` / `rakuten-worker-scaffold.md` / `next-cloud-agent-instructions.md` / `api-connection-plan.md`）と、価格が競合する旧プラン表（`coconala-package-plan.md`）、および旧バージョンの `release-v0.1-checklist.md` / `release-notes-v0.1.md` を `docs/archive/` へ移動
- `docs/release-v1-checklist.md` を新設
- `package.json` の version を `0.9.0-rc.1` に更新
- UI内のハードコードされた `v0.2` 表記（`ApiStatusPanel.tsx`）を撤去

## v0.2 — グラスUI刷新 + 販売準備整備

### 販売・納品ギャップ修正（Part A）

- データソースの正直化: 全カードに `サンプルデータ` / `モック（楽天API想定）` バッジ、
  ヘッダーに常時表示の「デモ表示中」バッジ、データソースの現在状態表示を追加（A1）
- 楽天市場 商品検索API の実接続: Cloudflare Pages Function `functions/api/rakuten.ts` を
  サーバー側プロキシとして追加。`SERVER_RAKUTEN_APP_ID` 設定時のみ `公式API取得` の実データに
  切替、未設定・失敗時は自動でモックにフォールバック（フロントにキーを置かない）（A2）
- アダプター層の整理: 検索を `runMarketSearch` に一本化し、未使用の eBay / Yahoo / mock
  スタブを削除（A3）
- ライセンス/利用規約 `TERMS.md` を追加（再販可否・免責を明記）。`package.json` の `license`
  を設定（A4）
- 依存バージョンを固定（`"latest"` を撤廃）し、CI とドキュメントを `npm ci` 基準へ（A5）
- 利益計算 / CSV出力の回帰テスト（Vitest）を追加し、CI に `npm run test` を追加（A6）

### グラスUI/UX 刷新（Part B）

- デザイントークン（フォント / 角丸 / アクセント色 / グラスの影 / ブラー）を Tailwind 設定へ移行し、
  `!important` の手書きユーティリティを撤廃（B1）
- 背面オーロラ光レイヤー + 微グレインで奥行きを追加（B2）
- フォント（Space Grotesk / Inter / Noto Sans JP）を実読み込み（B3）
- 3段エレベーションのグラス部品 `.glass` / `.glass-card` / `.glass-modal` と `.num` を整備（B4）
- 全コンポーネントをグラス言語に統一。利益額・価格を等幅の主役数値に。署名ボタン化（B5）
- 可視キーボードフォーカス、`prefers-reduced-motion` / `prefers-reduced-transparency`
  フォールバック、44px タッチターゲット、375px 対応（B6）

## v0.1 Demo (draft)

- アプリ上で `v0.1 Demo` と実API未接続の状態を明示
- 現在のデータソース表示と、デモモード説明パネルを追加
- 楽天APIモック0件時に候補キーワード案内を追加
- 長い商品名 / URL がモバイルで崩れにくいよう表示を調整
- README、デプロイ、バイヤー引き渡し、既知の制限事項、リリースノートを v0.1 向けに整理
