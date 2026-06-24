# CHANGELOG

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
