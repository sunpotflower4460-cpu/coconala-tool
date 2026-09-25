# CHANGELOG

## v0.9.0-rc.11 — 楽天の新API対応・動的監査の自動化・納品物の完成

販売前の最終検証。人が目で確認していた項目のほとんどを自動チェックに置き換えた。

### 重大な修正

- 楽天市場 商品検索API を新しい仕組み（`openapi.rakuten.co.jp`・2026-07-01版）へ移行。旧 `app.rakuten.co.jp` は
  2026-05-14 に提供終了しており、従来版は実キーを設定しても常に見本データになっていた
- 楽天のアプリID（`SERVER_RAKUTEN_APP_ID`）に加えてアクセスキー（`SERVER_RAKUTEN_ACCESS_KEY`）を必須にし、
  楽天の「許可されたWebサイト」と照合される Origin / Referer を送る（独自ドメイン用に `SERVER_RAKUTEN_ALLOWED_ORIGIN`）
- 楽天が受け付けない1文字の語（「Nintendo Switch 2」の「2」）を直前の語につなげて送り、よくある検索語が「使えない検索語」にならないように（本番の楽天APIで確認）
- 楽天の「該当なし（404）」を 0件として表示。キー・許可サイトの誤りは「設定を確認」、受け付けない検索語は「検索語の直し方」を案内
- 楽天の商品すべてに「新品」と表示していた誤りを削除。送料表記を楽天の定義どおり「送料込み / 送料別」に

### 画面の修正

- 再読込すると履歴・比較ボードが検索するまで見えなかった問題を修正（サイドバーを常時表示）
- 比較ボードをページを閉じても残るように（最大50件）。比較ボードのカードにも出どころラベルとサンプル/見本バッジを表示
- 検索0件でも「手動で追加」ができるように。例の検索語・見本データの検索（PS5 ⇔ PlayStation 5 等の同義語、空白区切りの全語一致）を改善
- 日本語入力の変換確定 Enter で検索が走る問題を修正
- 手動追加をダイアログとして操作しやすく（Esc で閉じる・フォーカス移動・スマホで下が切れない）。重複チェックに比較ボードも含める
- 価格入力で全角数字・カンマ・「1.5万円」「2万5千円」を正しく読み、数字が複数ある曖昧な表記は読まない（誤った ¥2 を作らない）
- 利益計算の手数料を1円未満切り捨てに統一し、端数（1,799.1円）が出ないように。金額欄の「0が消える・05になる」問題を修正
- CSV: 負の利益が文字列になる問題、信頼度・日時（日本時間）の表記、CR を含むセルの囲みを修正
- 画面の専門用語（モック・上流 等）を平易な言葉に。ヘッダーの表示を「実データ表示中 / デモ表示中 / 楽天市場モード」に整理
- テーマの初回表示のちらつきを防止。スマホでもテーマの見本色が区別できるように
- 文字コントラスト不足（WCAG AA）と、押しにくい小さなボタン（44px 未満）を修正
- 楽天ウェブサービス規約のクレジット表記（Supported by Rakuten Developers）を追加

### 安全性

- Workers のレート制限（1IPあたり60秒30回）で `/api/rakuten` の濫用を抑止
- 画面に CSP・X-Frame-Options 等のセキュリティヘッダー（`public/_headers`）、API 応答にも同等のヘッダー
- 楽天の応答サイズに上限、本文読み取り中のタイムアウトも正しく判定
- 依存パッケージの高深刻度の脆弱性を解消

### 自動チェック（動的監査）

- 偽の楽天API（公式仕様どおり）と本番同等の Worker をローカルで起動し、ブラウザから実データ表示と全障害パターンを検証
- PC / タブレット / スマホ（Chromium）と iPhone 相当（WebKit）で、表示崩れ・タップ領域・主要フローを検証
- axe-core による WCAG 2.1 AA のアクセシビリティ検査を4テーマで実施
- 故障注入: 保存禁止ブラウザ・保存容量超過・画像403・フォント不通・オフライン・Worker 不在
- `npm run verify:all` で、型・単体・ビルド・E2E・整合チェック・納品ZIP生成・ZIP展開後の再ビルドと静的版の動作確認まで一括実行

### 納品物

- 購入者専用の `README_FIRST.md`、公開ガイド（Workers 版の手順・楽天の新しいキー設定）を新設
- Node.js 不要の静的版 `app-static/` を同梱。品質チェック結果 `QUALITY_REPORT.md` を同梱
- 文書のリンクをZIPの構成に合わせて自動で書き換え、リンク切れがあれば生成を中断
- 公開先を Cloudflare Workers に一本化（Pages Functions 前提の記述を整理）

## v0.9.0-rc.10 — 販売前の履歴・API・検索競合ハードニング

新機能は追加せず、販売後に起きやすいデータ消失・誤表示・競合だけを塞いだ。

- 履歴 persist に version 0 → 1 の明示 migrate を追加。旧ユーザーの履歴を hydrate 時に落とさない
- 履歴保存の永続化失敗時は、上限超過後の「新件だけ削除」ではなく保存前配列へ完全 rollback する
- hydrate 時に searchStatus / searchWarnings / lastSearchedAt を検証して保持する（不正値だけ null）
- 楽天商品の不正価格を ¥0 に変換せず、その商品だけ除外する。正当な 0 円は残す
- 同一検索語でもリクエスト世代で古い応答を捨て、clear 後の再検索を上書きしない
- JSON の null / プリミティブ / 配列応答を通信失敗ではなく上流契約不整合として分類する
- Cloudflare Workers Builds 向けに `wrangler.jsonc`・Worker エントリ・`@cloudflare/vite-plugin` を追加（Worker 名 `coconala-tool`。既存 Pages Function と同じ `/api/rakuten` ハンドラ。E2E の `preview` は `vite preview` のまま）
- Workers Builds の GitHub チェックが即失敗する場合は、リポジトリ設定ではなく Cloudflare ダッシュボードの API トークン / Git 連携を直す手順を `docs/deployment-guide.md` に追記（品質ゲートは GitHub Actions `build`）

## v0.9.0-rc.9 — 本番故障リスクの残バグ修正

開発AIが見落としていた本番故障経路を、QA観点で再現テスト付きで塞いだ。

- 壊れた / 型違い localStorage を persist merge でサニタイズし、白画面や NaN円を防ぐ
- `javascript:` / `data:` / HTTP画像URLをカード描画・手動追加・履歴復元から排除
- 楽天商品で https 商品URLが無いカードを落とす。1件の壊れた商品で検索全体を通信失敗扱いにしない
- 検索クリア（×）が比較ボードと利益設定まで消していたデータ消失を修正
- 手数料率 0% が空欄＋プレースホルダ 10 に見えていた表示不整合を修正
- CSV のタブ/CR 起点 Formula Injection を無害化
- 履歴保存失敗時にメモリ上の一覧からも取り除く。削除は確認ダイアログ
- 手動入力に maxLength。Error Boundary で予期せぬ描画例外から復旧
- 他タブの localStorage 変更を `storage` イベントで再ハイドレート
- 再現手順と期待結果は `docs/PRODUCTION_FAILURE_RISK_MATRIX.md`

## v0.9.0-rc.8 — sticky ヘッダーの視認性強化（UI/UX調整）

- スクロール中、sticky ヘッダーの背景が薄すぎて下を通過するカードの文字と重なって見える
  不具合を修正。`.glass`（不透明度5%＋backdrop-filter任せ）をヘッダーに流用していたのが原因
- ヘッダー専用の `.glass-header` を新設し、`backdrop-filter` 非対応環境やOS設定
  （`prefers-reduced-transparency: reduce`）でも常に不透明な背景（`--color-bg-card-solid`）を
  保証。対応環境では `color-mix()` で82%不透明＋ぼかしのガラス表現を維持
  （backdrop-filter単体の対応状況に視認性を依存させない設計に変更）
- 他の `.glass` 使用箇所（サイドパネル・カード等）はスクロール時に背景と共に流れるため
  同種のリスクがなく、変更していない
- Playwrightでモバイル幅（375px）・デスクトップ幅の実スクロール（`mouse.wheel`）を用いた
  座標検証・スクリーンショット確認により、重なりが解消したことを確認
- `npm audit` で新たに検出された高深刻度の脆弱性（`brace-expansion` のDoS、`archiver`経由の
  推移的依存）を解消。当初は `overrides` で `brace-expansion` のみをパッチ版に固定する案を
  検討したが、`archiver@7` 系が使う旧 `minimatch`（`^2.0.x`系のbrace-expansion実装＝関数呼び出し
  API前提）は新しい `brace-expansion` の `expand` 名前付きエクスポートAPIと非互換で、
  `{a,b}` のようなbraceパターンを含むglobを処理すると `TypeError` になることをローカル検証で
  確認。この非互換を上書きで隠すのではなく、`archiver` を新しい `minimatch`（v10系、新APIに
  対応済み）を使うv8へ更新し、`scripts/create-delivery-package.mjs` 側もv8の新コンストラクタ
  （`archiver('zip', opts)` → `new ZipArchive(opts)`）に追従。`overrides` は不要になり撤去
  （`npm audit --audit-level=high` が0件に）

## v0.9.0-rc.7 — ココナラ販売物の完成（PR-7）

- `docs/coconala-listing-copy.md` を全面整備: サービスタイトルを master指示書の推奨表現
  「物販リサーチ用の相場比較ボードを導入します」に統一し、売り文句を追加
- 「できること」「できないこと」を明示セクション化（誇張表現の禁止事項を実装と突き合わせて明記）
- 「納品物」「追加見積の境界（どこまでが標準でどこからが別見積りか）」を明確化
- 「よくある質問」「返金・キャンセルの扱い」セクションを新設（返金・キャンセルは最終的に
  出品者が確定する草案として明記し、`docs/MANUAL_STEPS_SALES.md` と対応づけ）
- リポジトリ全体で `v0.1 Demo` 表記・旧ブランド名・誇張表現の残存がないことを再確認
- これでPR-1からPR-7まで、正式販売化 実装指示書のコード変更対象PRがすべて完了

これ以降の残作業（実API目視確認・実機確認・操作動画・商品画像・価格/規約の最終確認・
正式販売開始の判断）は `docs/MANUAL_STEPS_SALES.md` に記載のとおり、人間が行います。

## v0.9.0-rc.6 — 納品パッケージ自動生成（PR-6）

- `scripts/create-delivery-package.mjs` を追加（`npm run delivery:package`）。バージョン一致・
  `package-lock.json` 存在・`.env.example` 存在・シークレット混入なしを事前チェックし、
  1件でも失敗したらZIPを生成せず中断する
- コピー対象は除外リストではなく許可リスト方式（secure by default）。`.git` / `.github` /
  `node_modules` / `.env` / `.dev.vars` / 開発AI向け内部指示書（`AGENTS.md` 等）/
  出品者向け内部資料（`docs/coconala-listing-copy.md` 等）/ `docs/archive/` / `docs/adr/` は
  常に除外される
- 購入者向けドキュメントを新設: `docs/QUICK_START_BUYER.md`, `docs/SUPPORT_POLICY.md`,
  `docs/PRIVACY_AND_DATA.md`, `docs/DELIVERY_CONTENTS.md`
- 人間が行うべき作業を一元管理する `docs/MANUAL_STEPS_SALES.md` を新設
- 旧・納品チェックリスト `docs/delivery-checklist.md` を `docs/archive/` へ移動（
  `docs/release-v1-checklist.md` と `docs/DELIVERY_CONTENTS.md` に統合）
- 開発時に紛れ込んでいた不要ファイル（`src/README.md`。実装前のフェーズ0スキャフォールド
  メモで参照なし）を削除
- チェックサム生成・シークレット検出・事前チェック失敗時の中断を実際に動作させて確認

## v0.9.0-rc.5 — 自動QAとデプロイQA（PR-5）

- コンポーネントテスト基盤を追加（@testing-library/react + jsdom）。`vitest.setup.ts` でRTLの自動クリーンアップを明示登録
- `ProductSearchBar`（検索中表示・二重送信防止）/ `ProfitPanel`（入力クランプ・由来表示・税/手数料注記）/ `ResultCard`（データ種別・ソース区分バッジ）/ `AppShell`（公式API取得時のバッジ切替・0件案内）のコンポーネントテストを追加
- Playwright E2Eスイートを追加（サンプル検索・0件案内・比較追加・利益反映・手動追加・CSV出力・履歴保存/再開・375px横スクロールなし）
- CI（`.github/workflows/ci.yml`）を install → typecheck → unit → build → `npm audit --audit-level=high` → E2E の順に整理し、Lighthouse（accessibility/best-practices、非ブロッキング）を追加
- `functions/` ディレクトリを含む abort検出処理を `err.name` ベースのダックタイピングに修正（jsdom環境の `DOMException` が `instanceof Error` にならないケースへの対応。実行時の挙動もより堅牢に）
- `npm audit fix` で Vite の既知脆弱性（開発サーバーのWindows向け問題、ビルド成果物には影響なし）を解消し `npm audit` を0件に
- `.github/pull_request_template.md` を追加し、実機・実API確認欄を明示
- qa-checklist.md / release-v1-checklist.md をCI自動化項目と人間の手動確認項目に区分けして整理

## v0.9.0-rc.4 — 利益計算・入力・保存の販売品質化（PR-4）

- 仕入れ価格・販売価格・送料は0以上、手数料率は0〜100%にクランプ。NaN/Infinity/異常に大きい値は0またはMAX_AMOUNTに丸める
- 利益パネルに消費税・関税・固定手数料が含まれない旨の注記を追加
- 比較ボードから「この価格を仕入れ/販売に使う」で反映した価格の由来（サイト名・価格）を利益パネルに表示。手動編集すると由来表示は消える
- 手動追加にタイトル（任意・空欄時は自動生成）と通貨（JPY/USD）選択を追加
- 手動追加の価格パースを一元化された金額クランプに統一（負数・異常値を防止）
- リサーチ履歴にデータソース・検索状態・警告・検索日時を保存し、一覧に表示（「再開」はライブな検索結果として扱わない）
- 履歴保存の上限（20件）をUIに明記
- localStorage書き込み失敗（容量超過等）を検知して画面にエラー表示するように変更（zustandのpersistミドルウェアは失敗時にconsole.warnのみでエラーを再送出しないため、保存後にラウンドトリップ確認する方式を採用）
- CSV列見出しを日本語化し、データ種別（実データ/サンプルデータ/モック）・ソース区分・検索状態・検索日時・警告のサマリー列を追加
- CSV Formula Injection対策（`=` `+` `-` `@` で始まるセルの無害化）を追加
- ソース区分・データソース・検索状態のラベル定義を `types/market.ts` に集約し、`ResultCard` / `ApiStatusPanel` / CSV出力で共有（表記ゆれの防止）
- profitCalculator / manualCardFactory / historyStore / researchStore / csvExport のユニットテストを追加

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
