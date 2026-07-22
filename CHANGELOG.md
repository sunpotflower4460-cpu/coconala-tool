# CHANGELOG

## v0.9.0-rc.3 — 楽天APIプロキシの堅牢化（PR-3）

`functions/api/rakuten.ts` の入力検証・エラー分類・上限を強化した。

- GET以外のメソッドは明示的に405 `method_not_allowed` を返す（単一の `onRequest` ディスパッチャに統一）
- Origin ヘッダーが自ホストと異なる場合は403 `forbidden_origin`（同一オリジン運用が基本）
- `q` は trim後1〜100文字・制御文字除去、`limit` は1〜30にクランプ
- 上流通信に約8秒のタイムアウトを設定（504 `timeout`）
- 上流エラーを `rate_limited`（429）/ `upstream_client_error`（4xx）/ `upstream_error`（5xx）/ `invalid_json` に分類
- 商品名・ショップ名に最大長、商品URL・画像URLに `https:` のみ許可するフィルタを追加（型ガードで検証、新規依存追加なし）
- 応答に `source` / `status` / `requestId` を追加。内部例外・Application IDは引き続き一切返さない
- `functions/` を `npm run lint`（`tsc -b`）の対象に追加（従来は型チェック対象外だった）
- 応答はキャッシュしない方針を決定し、理由を `docs/adr/0001-no-rakuten-response-cache.md` に記録
- `docs/deployment-guide.md` に Cloudflare側レート制限の設定手順を追加（インメモリ実装では対応しない）
- `functions/api/rakuten.ts` のユニットテストを追加、`rakutenAdapter.ts` を新しいエラーコード体系に追従

## v0.9.0-rc.2 — 検索状態とフォールバックの正直化（PR-2）

検索結果に「なぜこのデータが表示されているか」を必ず示すようにした。

- `MarketSearchResponse` に `status` / `warnings` / `searchedAt` を追加し、`sample` / `official_api` / `empty` / `mock_no_key` / `mock_timeout` / `mock_network` / `mock_rate_limited` / `mock_upstream_error` を区別
- 楽天アダプターにクライアント側タイムアウト（10秒・AbortController）を追加し、キー未設定・タイムアウト・ネットワーク失敗・レート超過（429）・上流エラー・非JSON応答をそれぞれ別の理由としてUIに表示
- 検索結果の上に、直近の検索状態に応じた理由バナー（成功／フォールバック理由／0件案内）を表示
- 楽天市場 公式APIから実データを取得できたときのみ、ヘッダーとイントロ文の「デモ表示中」表示を緑色の「公式データ取得中」に切り替え
- サンプルモードの検索を、検索語でタイトル・サイト名を絞り込むように変更（大文字小文字・前後空白を無視）。0件時は専用の案内を表示
- 検索中はボタンを「検索中…」表示にして無効化し、二重送信を防止
- データソース選択肢名を「楽天APIモック」から「楽天市場」に変更（内部で公式API/モックを自動判定）。API接続準備ステータスに直近の検索状態を表示
- サンプルデータの eBay / Yahoo!ショッピング カードが `sourceType: 'official_api'`（`公式API取得`）を誤って名乗っていたのを `search_api`（`検索表示から推定`）に修正
- 比較ボードのカードは新しい検索をしても消えない仕様であることをユーザーガイドに明記
- `rakutenAdapter` / サンプル検索フィルタのユニットテストを追加（成功・0件・キー未設定・429・5xx・非JSON・ネットワークエラー・タイムアウト・部分一致・大文字小文字・空白）

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
