# 本番故障リスク・再現テストマトリクス

最終更新: 2026-09-01

対象: 相場カード比較ボード (`coconala-tool`) v0.9.0-rc.10

目的: 本番運用で起こり得る故障を、API / 認証・秘密情報 / 通信 / 同時実行 / データ不整合 / ユーザー操作 / 外部サービス障害 / セキュリティの観点から洗い出し、**各リスクに再現手順と期待結果を持たせる**。

この文書では「CIで通った」ことと「本番・実機で確認した」ことを分ける。自動化できない項目は、本番公開前の手動QAとして残す。

## 判定記号

- **Protected**: 現在コードに防御があり、自動テストも存在する/本PRで追加した
- **Partial**: 一部防御あり。運用または追加テストが必要
- **Open**: 未対策または仕様決定が必要
- **External**: アプリコードだけでは完全には防げず、Cloudflare / 楽天 / ブラウザ等の運用対策が必要

重大度:

- **P0**: データ漏えい、秘密情報漏えい、誤った実データ表示、継続利用不能など。正式販売前に必ず確認
- **P1**: 一時的な機能停止、データ不整合、誤認につながる。原則販売前に確認
- **P2**: UX低下や限定条件の不具合。初回販売後の改善でも可

---

# 1. API

## API-01 非GETメソッドでプロキシを叩く

- 重大度: P1
- 状態: Protected
- 故障: 意図しないPOST/PUT等を受理し、将来の処理追加時に攻撃面が広がる
- 再現: `POST /api/rakuten?q=PS5`
- 期待結果: HTTP 405 / `error=method_not_allowed`。楽天APIへは通信しない
- 自動テスト: `functions/api/rakuten.test.ts`

## API-02 空・制御文字のみ・101文字以上の検索語

- 重大度: P1
- 状態: Protected
- 故障: 無意味なリクエスト、ログ汚染、上流APIへの異常入力
- 再現:
  1. `q=`
  2. `q=%0A%09`
  3. 101文字の文字列
- 期待結果: HTTP 400 / `invalid_query`。上流へ送らない
- 自動テスト: `functions/api/rakuten.test.ts`

## API-03 `limit` の境界・小数・非数値

- 重大度: P1
- 状態: Protected（本PRで整数化を追加）
- 故障: 楽天側へ `hits=3.9` 等の不正値を送り、4xxや予期せぬ挙動になる
- 再現: `limit=0`, `limit=-1`, `limit=3.9`, `limit=999`, `limit=abc`
- 期待結果: 整数1〜30へ正規化。非数値は8。上流へ小数を送らない
- 自動テスト: `functions/api/rakuten.test.ts`

## API-04 上流429 / 4xx / 5xx

- 重大度: P1
- 状態: Protected
- 故障: レート超過や認証失効を正常データと誤認する
- 再現: mock fetchで429 / 401 / 500を返す
- 期待結果:
  - 429 -> `rate_limited`
  - 4xx -> `upstream_client_error`
  - 5xx -> `upstream_error`
  - 上流本文はクライアントへ透過しない
- 自動テスト: `functions/api/rakuten.test.ts`, `src/services/marketAdapters/rakutenAdapter.test.ts`

## API-05 200だがJSON破損 / `items`契約違反 / null・プリミティブ応答

- 重大度: P0
- 状態: Protected（本PRで null/primitive/array を契約不整合へ分類）
- 故障: API仕様変更やEdge誤配信を「検索結果0件」または「通信失敗」と誤認し、利用者に間違った判断をさせる
- 再現:
  1. Content-TypeはJSONだが `json()` がSyntaxError
  2. HTTP 200で `{ status: 'ok' }` のみ返す
  3. HTTP 200 JSON が `null` / `"hello"` / `123` / `[]` / `{}`
  4. HTTP 200 JSON が `{ items: [] }`
- 期待結果:
  - 1〜3: `mock_upstream_error`（`mock_network` ではない）。「0件」とは表示しない
  - 4: 正常な empty 検索
- 自動テスト: `src/services/marketAdapters/rakutenAdapter.test.ts`

## API-06 楽天商品データの必須フィールド欠落 / 不正URL / 不正価格

- 重大度: P0
- 状態: Protected（本PRで不正価格の ¥0 変換を廃止）
- 故障: 壊れたカード、危険なURL、`楽天市場公式API ¥0` による誤った利益計算
- 再現: itemCodeなし、itemNameなし、HTTP画像/商品URL、undefined / `"abc"` / NaN / Infinity / 負価格を含むItems
- 期待結果: 必須フィールド欠落・不正価格のカードは除外。URLはHTTPSのみ。不正値を 0 へ変換しない。正当な 0 円は残す。検索全体は成功
- 自動テスト: `functions/api/rakuten.test.ts`, `src/services/marketAdapters/rakutenMapper.test.ts`

## API-07 巨大な上流レスポンス

- 重大度: P2
- 状態: Partial
- 故障: JSON parse時のメモリ/CPU増大
- 再現: テスト環境で数MB〜数十MB相当のItemsを返す
- 期待結果: Functionsの制限内で失敗しても502/モックへ倒れ、秘密情報を返さない。80件程度の肥大 Items は正規化して返し、名前はクランプ、キーは返さない
- 自動テスト: `functions/api/rakuten.test.ts`（80件・長文。数十MB級は未実施）

## API-08 HEAD / OPTIONS / PUT / DELETE / PATCH

- 重大度: P1
- 状態: Protected
- 故障: 将来の処理追加時に攻撃面が広がる。CORS preflight（OPTIONS）を誤って 200 で通す
- 再現: `HEAD|OPTIONS|PUT|DELETE|PATCH /api/rakuten?q=PS5`
- 期待結果: いずれも HTTP 405 / `method_not_allowed`。楽天APIへは通信しない
- 自動テスト: `functions/api/rakuten.test.ts`

## API-09 重複クエリ `q=PS5&q=Nintendo`

- 重大度: P1
- 状態: Protected
- 故障: 後勝ち/配列化で想定外キーワードを上流へ送り、表示と検索が食い違う
- 再現: `GET /api/rakuten?q=PS5&q=Nintendo`
- 期待結果: 先頭の `q=PS5` のみを keyword として送る
- 自動テスト: `functions/api/rakuten.test.ts`

## API-10 Unicode / 全角 / 絵文字の検索語

- 重大度: P2
- 状態: Protected
- 故障: エンコード漏れで 400、または上流へ壊れたバイト列を送る
- 再現: `q=ＰＳ５🎮`（URLエンコード）
- 期待結果: 200。上流 `keyword` は元の文字を保持。アプリは落ちない
- 自動テスト: `functions/api/rakuten.test.ts`

## API-11 検索語への `applicationId` インジェクション

- 重大度: P0
- 状態: Protected
- 故障: `q=PS5&applicationId=attacker` が楽天URLの別パラメータとして解釈され、キーを差し替えられる
- 再現: `q=` に `PS5&applicationId=attacker-key&hits=1` をエンコードして送る
- 期待結果: `URLSearchParams.set` により keyword 1値としてエンコードされる。`applicationId` はサーバーキーのまま
- 自動テスト: `functions/api/rakuten.test.ts`

## API-12 Worker パスの末尾スラッシュ / 大文字

- 重大度: P1
- 状態: Protected
- 故障: リバプロが `/api/rakuten/` を付けると 404 HTML になり、フロントが実データもモックも正しく扱えない
- 再現:
  1. `GET /api/rakuten/?q=PS5`
  2. `GET /API/rakuten?q=PS5`
- 期待結果:
  1. 既存ハンドラと同じ（キー未設定なら 503 `no_key`）
  2. Worker は API として扱わず 404（静的SPA側へ任せる）
- 自動テスト: `worker.test.ts`

## API-13 `Origin: null`

- 重大度: P0
- 状態: Protected
- 故障: サンドボックス iframe / ローカルファイルからプロキシを叩ける
- 再現: `Origin: null`
- 期待結果: 403 `forbidden_origin`
- 自動テスト: `functions/api/rakuten.test.ts`

## API-14 formatVersion=2 フラット Items

- 重大度: P1
- 状態: Protected
- 故障: `{ Item: {...} }` だけ想定すると実APIのフラット配列を全件捨て、「0件」と誤認する
- 再現: `Items: [{ itemCode, itemName, itemPrice, itemUrl }]`（Item ラッパなし）
- 期待結果: 正規化してカード化。status ok
- 自動テスト: `functions/api/rakuten.test.ts`

## API-15 文字列価格 / カンマ価格 / 指数表記

- 重大度: P0
- 状態: Protected
- 故障: `"79,800"` や `1e20` を 0 円や巨大値として利益計算する
- 再現: itemPrice が `"79800"` / `"79,800"` / `1e20`
- 期待結果: 数字文字列のみ採用。カンマ付き・上限超えは除外。¥0 へ変換しない
- 自動テスト: `functions/api/rakuten.test.ts`, `rakutenMapper.test.ts`

---

# 2. 認証・秘密情報

> この製品にはユーザーアカウント認証はない。認証観点では、主に楽天Application IDと公開プロキシの利用境界を扱う。

## AUTH-01 APIキー未設定 / 空白のみ

- 重大度: P1
- 状態: Protected
- 故障: 空のキーを上流へ送り、原因不明のエラーになる
- 再現: `SERVER_RAKUTEN_APP_ID` 未定義 / `'   '`
- 期待結果: 503 `no_key`。フロントは `mock_no_key` を表示
- 自動テスト: `functions/api/rakuten.test.ts`, `rakutenAdapter.test.ts`

## AUTH-02 APIキー失効・誤キー

- 重大度: P1
- 状態: Protected/Manual
- 故障: 楽天側401/403
- 再現: 無効なApplication IDを本番Previewに設定
- 期待結果: アプリは落ちず、実データ表示にしない。モック＋上流エラー警告へフォールバック
- 手動テスト: Cloudflare Previewで実施

## AUTH-03 Application IDがレスポンス・ビルド成果物へ漏れる

- 重大度: P0
- 状態: Protected
- 故障: キー漏えい
- 再現:
  1. fetch例外文にApplication IDを含める
  2. 成功/失敗レスポンス本文を検索
  3. `grep -r "SERVER_RAKUTEN\|実キー値" dist/`
- 期待結果: 0件。例外本文も返さない
- 自動テスト: `functions/api/rakuten.test.ts`
- 手動/CI: release checklistのsecret scan

## AUTH-04 公開プロキシURLを第三者が直接叩く

- 重大度: P0
- 状態: External / Open
- 故障: Application ID自体は隠れていても、第三者が `/api/rakuten` を連打して楽天API枠を枯渇させる
- 再現: 別PC/CLIからOriginなしで本番 `/api/rakuten?q=PS5` を連続実行
- 期待結果: **コードだけで完全防止はできない**。Cloudflare Rate Limiting/WAFで閾値超過を429/ブロックし、通常利用は維持する
- 販売前条件: Cloudflare側のrate limit設定手順をデプロイガイドへ反映することを推奨

## AUTH-05 Worker env の Application ID 引き回し

- 重大度: P0
- 状態: Protected
- 故障: Pages Function では隠れていても Worker エントリが env を渡さず常に no_key、またはレスポンスへキーが混入
- 再現: `worker.fetch(..., { SERVER_RAKUTEN_APP_ID: 'secret' })` で空 Items を返す mock
- 期待結果: 上流には applicationId が付く。クライアント本文・エラーに secret は出ない
- 自動テスト: `worker.test.ts`

## AUTH-06 フロントに `VITE_` でキーを置いてしまう

- 重大度: P0
- 状態: Protected / Continuous
- 故障: ビルド成果物にキーが埋め込まれる
- 再現: `grep -R "VITE_.*RAKUTEN\\|SERVER_RAKUTEN" dist src --exclude-dir=node_modules`
- 期待結果: フロント固定値なし。サーバー env のみ
- 手動/CI: release checklist の secret scan。コード上 `VITE_` 楽天キーは存在しない

---

# 3. 通信

## NET-01 ブラウザがオフライン / DNS失敗 / TLS失敗

- 重大度: P1
- 状態: Protected
- 故障: fetchがrejectし、検索ボタンが永久ローディングになる
- 再現: DevTools OfflineまたはfetchをTypeErrorでreject
- 期待結果: `mock_network`。`isSearching=false`へ戻り、アプリ操作を継続可能
- 自動テスト: `rakutenAdapter.test.ts`

## NET-02 応答が来ない（half-open）

- 重大度: P1
- 状態: Protected
- 故障: 永久待機
- 再現: fetch Promiseをresolveしない
- 期待結果: サーバー約8秒で504 timeout、クライアント側も10秒でabort可能
- 自動テスト: `functions/api/rakuten.test.ts`, `rakutenAdapter.test.ts`

## NET-03 HTMLエラーページを返す

- 重大度: P1
- 状態: Protected
- 故障: Cloudflare/誤デプロイのHTMLをJSONとして処理してクラッシュ
- 再現: `/api/rakuten` がContent-Type `text/html`を返す
- 期待結果: `mock_upstream_error`。画面は落ちない
- 自動テスト: `rakutenAdapter.test.ts`

## NET-04 JSON宣言だが途中切断

- 重大度: P1
- 状態: Protected（本PR追加）
- 故障: `res.json()` SyntaxErrorを「ネットワーク障害」と誤分類、または未処理例外
- 再現: Content-Type JSON + `json()` reject
- 期待結果: `mock_upstream_error`。未処理Promise rejectionなし
- 自動テスト: `rakutenAdapter.test.ts`

## NET-05 CDN/ブラウザキャッシュで古い価格を返す

- 重大度: P0
- 状態: Protected
- 故障: 過去価格を最新と誤認
- 再現: APIレスポンスヘッダー確認
- 期待結果: `Cache-Control: no-store`。API結果はキャッシュしない
- 自動テスト: `functions/api/rakuten.test.ts`

## NET-06 204 / 空 Content-Type / charset 付き JSON

- 重大度: P1
- 状態: Protected
- 故障: 空応答や `application/json; charset=utf-8` を誤分類し、通信失敗やクラッシュになる
- 再現:
  1. HTTP 204 + 空 Content-Type
  2. `Content-Type: application/json; charset=utf-8` + `{ items: [] }`
- 期待結果:
  1. `mock_upstream_error`（`mock_network` ではない）
  2. 正常な empty 検索
- 自動テスト: `rakutenAdapter.test.ts`

## NET-07 未知のエラーコード `fetch_failed`

- 重大度: P1
- 状態: Protected
- 故障: プロキシの `fetch_failed` を無視して空成功や例外にする
- 再現: JSON `{ error: 'fetch_failed' }` + HTTP 502
- 期待結果: `mock_upstream_error`
- 自動テスト: `rakutenAdapter.test.ts`

---

# 4. 同時実行・競合

## CONC-01 検索ボタン連打 / Enter連打

- 重大度: P1
- 状態: Protected
- 故障: 同じAPIを二重送信し、レート枠消費・状態競合
- 再現: 検索開始直後にボタンを再クリック、または Enter 連打
- 期待結果: `isSearching`中は2回目を送らない（`beginSearch` が null）
- 自動テスト: `ProductSearchBar.test.tsx`, `researchStore.test.ts`

## CONC-02 検索中に検索語を変更

- 重大度: P0
- 状態: Protected
- 故障: 画面の検索語はNintendoなのに、遅れて返ったPS5カードが表示される
- 再現: PS5検索開始 -> 応答前に入力をNintendoへ変更 -> PS5応答をresolve
- 期待結果: 旧応答は破棄。現在クエリと結果を混在させない
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-03 検索中にデータソース切替

- 重大度: P0
- 状態: Protected
- 故障: 「楽天市場」表示なのにサンプル検索結果が後着して表示される
- 再現: sample検索開始 -> 応答前にrakutenへ切替 -> sample応答をresolve
- 期待結果: 旧モード応答は破棄
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-04 検索中にクリア/リセット

- 重大度: P1
- 状態: Protected（リクエスト世代で無効化）
- 故障: ユーザーが消した直後に結果が復活
- 再現: 検索開始 -> Xでクリア -> 応答到着
- 期待結果: 結果を復活させない。進行中リクエストの `setIsSearching(false)` も新しい検索を上書きしない
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-04b 同一クエリでの古いレスポンス競合

- 重大度: P0
- 状態: Protected（本PRでリクエスト世代を追加）
- 故障: PS5検索A → クリア → 再びPS5検索B。Bが先に返りAが後から上書きする
- 再現: 同一クエリの deferred を2本立て、Bを先に resolve してから A を resolve
- 期待結果: Bの結果が残る。Aは無視。`isSearching` も B 基準
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-05 同じアプリを複数タブで開き、両方から履歴保存/削除

- 重大度: P1
- 状態: Protected
- 故障: localStorageのlast-write-winsで別タブの更新を上書き
- 再現: Tab A/Bを開く -> A保存 -> B保存/削除
- 期待結果: 他タブの `storage` イベントで履歴/設定を再ハイドレートする。同時書き込みの完全なマージはしない
- 自動テスト: 手動（2タブ）+ `e2e/production-failure.spec.ts` + `historyStore.test.ts`。再ハイドレート実装は `historyStore.ts` / `researchStore.ts`

## CONC-06 検索中に履歴再開

- 重大度: P0
- 状態: Protected
- 故障: 再開後に遅延した検索結果が、保存スナップショットを上書きする
- 再現: beginSearch のあと `loadResearchSession`
- 期待結果: 旧 requestId は無効。`isSearching=false`。`searchStatus` は null（ライブな公式取得中と誤認しない）
- 自動テスト: `researchStore.test.ts`, `AppShell.test.tsx`

## CONC-07 同じカードの比較追加連打

- 重大度: P2
- 状態: Protected
- 故障: 同一 id が比較ボードに複数入り、利益反映が重複する
- 再現: `addComparedCard` を同一カードで2回
- 期待結果: 1件のまま
- 自動テスト: `researchStore.test.ts`

## CONC-08 Enter 連打

- 重大度: P1
- 状態: Protected
- 故障: ボタン無効化前に keydown が二重発火し API を二重送信
- 再現: 入力後 Enter を2回
- 期待結果: `runMarketSearch` は1回
- 自動テスト: `ProductSearchBar.test.tsx`

---

# 5. データ不整合・永続化

## DATA-01 localStorage容量超過

- 重大度: P0
- 状態: Protected（本PRで保存前配列へ完全 rollback）
- 故障: 20件上限で新規保存に失敗すると、最古1件が戻らず履歴が19件になる
- 再現: 既存20件 → 21件目保存 → `localStorage.setItem` を QuotaExceededError にする
- 期待結果: 「保存に失敗」と表示し、成功扱いしない。保存前の20件が完全に残る。新規履歴だけ存在しない
- 自動テスト: `historyStore.test.ts`

## DATA-02 ブラウザでStorage利用が禁止

- 重大度: P1
- 状態: Partial
- 故障: SecurityErrorでアプリ全体が落ちる/履歴保存を成功扱いする
- 再現: localStorage getterをthrowさせる
- 期待結果: アプリ主要機能は継続。履歴保存は失敗表示
- 自動テスト: `historyStore.test.ts`（検知関数）

## DATA-03 localStorage JSONが手動編集/破損

- 重大度: P1
- 状態: Protected
- 故障: Zustand hydration時に不正値・古い構造が混入し、画面クラッシュや誤計算
- 再現: DevTools Applicationで `coconala-tool-research` / `coconala-tool-history` を壊れたJSONや型違いへ変更してreload
- 期待結果: 既定値へフォールバックし、画面をクラッシュさせない。javascript: URLは除去。利益設定はクランプ
- 自動テスト: `src/lib/persistSanitize.test.ts`, `researchStore.test.ts`, `e2e/core-flows.spec.ts`

## DATA-04 将来バージョンで保存形式を変更 / version 0 履歴

- 重大度: P0
- 状態: Protected（本PRで persist migrate 0→1 を追加）
- 故障: version 未指定で保存された履歴が version 1 の hydrate で全消失する。検索メタデータが reload で消える
- 再現:
  1. `{ state: { sessions: [正常] }, version: 0 }` を localStorage に入れて起動
  2. sessions 内に壊れた1件を混ぜる
  3. 完全に壊れた JSON
- 期待結果:
  1. version 1 へ migrate。件数・名前・検索語・カード・利益設定・searchStatus 等を保持
  2. 壊れた1件だけ除外
  3. 空履歴へフォールバックし白画面にしない
- 自動テスト: `src/lib/persistSanitize.test.ts`, `src/features/history/historyStore.test.ts`, `e2e/core-flows.spec.ts`

## DATA-05 利益設定にNaN/Infinity/負数/100%超手数料

- 重大度: P0
- 状態: Protected
- 故障: `NaN円`、無限値、誤利益
- 再現: 各入力へ異常数値を設定
- 期待結果: 金額0〜100,000,000、手数料0〜100%に正規化
- 自動テスト: `researchStore.test.ts`, `profitCalculator.test.ts`

## DATA-06 CSV Formula Injection

- 重大度: P0
- 状態: Protected
- 故障: 商品名/メモが `=`, `+`, `-`, `@` で始まり、Excelで式として実行される
- 再現: `=HYPERLINK(...)` 等をカード名に入れてCSV出力
- 期待結果: 先頭へ `'` を付けテキスト化
- 自動テスト: `csvExport.test.ts`

## DATA-07 Prototype pollution（`__proto__` / constructor）

- 重大度: P0
- 状態: Protected
- 故障: 壊した localStorage で Object.prototype や theme を汚染し、全ユーザー操作が壊れる
- 再現: persist JSON に `__proto__` / `constructor` を入れて hydrate
- 期待結果: 許可キー以外は採用しない。既定 theme を汚染しない
- 自動テスト: `persistSanitize.test.ts`

## DATA-08 persist に検索中フラグやカード配列が残る

- 重大度: P1
- 状態: Protected
- 故障: リロード後も `isSearching=true` のままボタンが死ぬ。古い検索結果が「最新」として残る
- 再現: 検索中に localStorage `coconala-tool-research` を見る
- 期待結果: persist は theme / dataSourceMode / profitSettings のみ
- 自動テスト: `researchStore.test.ts`

## DATA-09 履歴再開なのに「公式データ取得中」になる / 逆に公式カードなのにデモと矛盾

- 重大度: P0
- 状態: Protected
- 故障: 保存時点の公式取得を、再開後もライブ接続と誤認する
- 再現: `searchStatus=official_api` の履歴を再開
- 期待結果: ヘッダーはデモ表示。カードのソースラベル（当時の種別）は残る。ライブバッジは出ない
- 自動テスト: `AppShell.test.tsx`, `e2e/production-failure.spec.ts`

## DATA-10 為替レート 0 で USD が ¥0 になる

- 重大度: P0
- 状態: Protected
- 故障: `$100 × 0 = 0円` を仕入れに適用し、利益が過大に見える
- 再現: USD カードを比較に入れ、ドル円レートを 0 にする
- 期待結果: 円換算不能。仕入れ/販売に使うボタンは無効
- 自動テスト: `profitCalculator.test.ts`, `CompareBoard.test.tsx`

## DATA-11 未知キーや XSS 文字列を persist に混入

- 重大度: P1
- 状態: Protected
- 故障: 将来フィールドや script が state に混ざり、表示や計算が壊れる
- 再現: `{ theme, isSearching, query: '<script>' }` を sanitize
- 期待結果: theme のみ残る
- 自動テスト: `persistSanitize.test.ts`

## DATA-12 比較ボード件数に上限がない

- 重大度: P2
- 状態: Partial
- 故障: 大量追加で localStorage / 描画が重くなる
- 再現: 比較カードを数十件追加
- 期待結果: 現状は id 重複だけ防ぐ。件数上限は未実装。履歴は 20 件で抑制
- 自動化: 重複防止のみ `researchStore.test.ts`

---

# 6. ユーザー操作

## USER-01 無効/危険な商品URLを手動追加

- 重大度: P0
- 状態: Protected
- 故障: `javascript:` 等の危険リンクを「元ページ」で開く
- 再現: `javascript:void(0)`, `data:text/html,...`, 不正URL
- 期待結果: http/https以外を拒否しカードを作らない
- 手動/既存QA: `docs/qa-checklist.md`

## USER-02 100文字を超える検索語を入力

- 重大度: P1
- 状態: Protected（本PRでUI上限をサーバー契約と統一）
- 故障: フロントでは入力できるのにサーバー400となり、利用者には原因が分かりにくい
- 再現: 101文字入力
- 期待結果: 入力欄で100文字を上限にする
- 自動テスト: `ProductSearchBar.test.tsx`

## USER-03 極端に長い手動タイトル/メモ/画像URL

- 重大度: P2
- 状態: Protected
- 故障: UI性能低下、localStorage容量圧迫
- 再現: 数十万文字をフォームへ貼付
- 期待結果: タイトル200 / メモ500 / URL 2000 等の maxLength で入力を制限する
- 自動テスト: フォーム maxLength。サニタイズは `persistSanitize.test.ts`

## USER-06 検索クリア（×）が比較と利益まで消える

- 重大度: P1
- 状態: Protected
- 故障: 「検索内容をクリア」と書いてあるのに比較ボードと利益入力が消える
- 再現: 比較に追加してから検索欄の × を押す
- 期待結果: 検索語と検索結果だけ消える。比較ボードと利益設定は残る
- 自動テスト: `researchStore.test.ts`, `ProductSearchBar.test.tsx`, `e2e/core-flows.spec.ts`

## USER-04 同一URLを複数回手動追加

- 重大度: P2
- 状態: Protected/Intentional
- 故障: 比較カード重複による誤操作
- 再現: 同URLを2回入力
- 期待結果: 警告を表示。ただし別価格/状態の記録需要があるため追加自体は禁止しない
- QA: `docs/qa-checklist.md`

## USER-05 履歴削除を誤クリック

- 重大度: P2
- 状態: Protected
- 故障: 元に戻せない履歴削除
- 再現: 履歴の削除をクリック
- 期待結果: 確認ダイアログ後に削除。キャンセルなら残る
- 自動テスト: `e2e/core-flows.spec.ts`

## USER-07 検索欄に URL を貼る

- 重大度: P1
- 状態: Protected
- 故障: URL をキーワードとして送りアプリが落ちる、または意図しない外部リクエスト
- 再現: `https://jp.mercari.com/search?keyword=PS5` でサンプル検索
- 期待結果: 例外にしない。該当なしまたは部分一致。外部へスクレイピングしない
- 自動テスト: `marketSearchService.test.ts`, `e2e/production-failure.spec.ts`

## USER-08 例外時の復旧で全データ消去

- 重大度: P1
- 状態: Protected
- 故障: 白画面のまま操作不能。または復旧ボタンが storage を消さずループする
- 再現: 子コンポーネントが throw
- 期待結果: エラー画面。「保存データを消して再読み込み」で2キーを削除して reload
- 自動テスト: `AppErrorBoundary.test.tsx`

## USER-09 URL を検索語にしてもショートカットが壊れない

- 重大度: P1
- 状態: Protected
- 故障: `&` `"` `<script>` が検索リンクへ生挿入され、別サイトへ誘導される
- 再現: `buildSearchLinks('PS5&foo="bar"<script>')`
- 期待結果: `encodeURIComponent` 済み。https 絶対URLのみ
- 自動テスト: `searchLinkBuilder.test.ts`

---

# 7. 外部サービス障害

## EXT-01 楽天API全面停止

- 重大度: P1
- 状態: Protected
- 故障: 5xx/timeout
- 再現: upstream fetchを500またはtimeout
- 期待結果: アプリは継続しモックへフォールバック。実データと誤表示しない
- 自動テスト: proxy/adapter tests

## EXT-02 楽天APIレート制限

- 重大度: P1
- 状態: Protected + External
- 故障: 429
- 再現: upstream 429
- 期待結果: `mock_rate_limited`と「時間を置く」案内。自動リトライ連打はしない
- 自動テスト: adapter tests

## EXT-03 楽天API仕様変更

- 重大度: P0
- 状態: Protected/Partial
- 故障: `Items`消失、字段型変更
- 再現: `Items`無し、必須字段欠落
- 期待結果: 正常0件と誤認しない。`invalid_json`/`mock_upstream_error`
- 自動テスト: proxy/adapter tests

## EXT-04 Cloudflare Pages Functionsだけ停止 / 誤デプロイ

- 重大度: P1
- 状態: Protected/Manual
- 故障: 静的UIは表示されるが `/api/rakuten` が404/HTML
- 再現: Functionsを持たない静的Previewへデプロイ
- 期待結果: 楽天モードはモック＋警告。サンプル/手動機能は利用可能
- 手動テスト: Preview環境

## EXT-05 Cloudflare Pages全体停止

- 重大度: P1
- 状態: External
- 故障: UI自体へアクセス不能
- 再現: DNS/Pagesを一時的に切る（本番で故意に実施しない）
- 期待結果: アプリ内では対処不能。購入者向けサポートでCloudflare status確認・復旧待ち・必要なら別hostへの再デプロイ手順を案内

## EXT-06 GitHub Pages/Vercel等、Functions非対応hostへの誤配布

- 重大度: P1
- 状態: Documented
- 故障: 楽天実APIが動かない
- 再現: GitHub Pagesへ静的デプロイ
- 期待結果: UI/モックは動くが「公式API取得」にはならない。README/販売文と一致
- 手動テスト: deployment guide

## EXT-07 楽天が 200 で error オブジェクトだけ返す

- 重大度: P0
- 状態: Protected
- 故障: エラー詳細を利用者へ出したり、空成功にして 0件と誤認する
- 再現: `{ error: '...', error_description: 'secret-detail' }` で Items なし
- 期待結果: 502 `invalid_json`。詳細本文は透過しない。フロントは `mock_upstream_error`
- 自動テスト: `functions/api/rakuten.test.ts`

## EXT-08 商品画像 CDN が 403 / 壊れる

- 重大度: P2
- 状態: Protected
- 故障: 壊れた img でレイアウト崩壊
- 再現: 画像 URL が 403（`onError`）
- 期待結果: NO IMAGE プレースホルダ。カード自体は残る
- コード: `ResultCard.tsx` / `CompareBoard.tsx` の `onError`

## EXT-09 検索ショートカット先（メルカリ等）の仕様変更

- 重大度: P2
- 状態: External
- 故障: リンクが 404 や別検索になる
- 再現: 各ショートカットを開く
- 期待結果: アプリは落ちない。リンク切れは手動更新。スクレイピングしない
- 手動テスト: post-deploy QA

## EXT-10 Google Fonts CDN 障害

- 重大度: P2
- 状態: External
- 故障: フォントだけシステムフォントへフォールバック。機能は維持
- 再現: fonts.googleapis.com をブロック
- 期待結果: 検索・比較・利益は操作可能

---

# 8. セキュリティ

## SEC-01 別originからfetch

- 重大度: P0
- 状態: Protected
- 故障: 他サイトからAPI枠を消費される
- 再現: `Origin: https://evil.example.com`
- 期待結果: 403 `forbidden_origin`
- 自動テスト: `functions/api/rakuten.test.ts`

## SEC-02 同hostだが別scheme / same-siteサブドメイン / img等のcross-site resource request

- 重大度: P0
- 状態: Protected（本PR強化）
- 故障: hostだけ比較すると `http://example.pages.dev` を許可。Originを送らない`<img>`等でもAPI枠を消費できる
- 再現:
  - `Origin: http://example.pages.dev`
  - Originなし + `Sec-Fetch-Site: same-site`
  - Originなし + `Sec-Fetch-Site: cross-site`
- 期待結果: 403
- 自動テスト: `functions/api/rakuten.test.ts`

## SEC-03 Origin/Sec-Fetch-Site無しのCLIから公開プロキシを濫用

- 重大度: P0
- 状態: External / Open
- 故障: HTTPヘッダーは攻撃者が自由に作れるため、ブラウザorigin検証だけでは防げない
- 再現: `curl 'https://<host>/api/rakuten?q=PS5'` を高頻度実行
- 期待結果: Cloudflare Rate Limiting/WAFで抑止。必要なら認証付き非公開運用を選ぶ
- 備考: このリスクを「CORSで防げる」と誤認しないこと

## SEC-04 API/手動文字列によるXSS

- 重大度: P0
- 状態: Protected/Partial
- 故障: 商品名等にHTML/scriptを入れて実行
- 再現: `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` をタイトル/ショップ名へ入れる
- 期待結果: Reactのテキスト描画として表示され、HTMLとして実行されない
- 追加推奨: E2Eで `window.alert` が呼ばれないことを回帰確認
- 自動テスト: `ResultCard.test.tsx`, `e2e/production-failure.spec.ts`

## SEC-05 外部リンクのreverse tabnabbing

- 重大度: P1
- 状態: Protected
- 故障: 新規タブから元画面の`window.opener`を操作
- 再現: 元ページリンクを開く
- 期待結果: `target=_blank`には`rel="noopener noreferrer"`
- コード確認: `ResultCard.tsx`等
- 自動テスト: `ResultCard.test.tsx`, `e2e/production-failure.spec.ts`

## SEC-06 手動画像URLによる外部トラッキング/混在コンテンツ

- 重大度: P2
- 状態: Protected
- 故障: 手動追加した画像URLへブラウザがアクセスし、第三者へIP/Referer等が渡る。HTTP画像はHTTPSページでブロックされる可能性。javascript: が img/href に入る
- 再現: `javascript:alert(1)` や `http://` 画像URLを手動追加。履歴から javascript: カードを復元
- 期待結果: ページURLは http/https のみ。画像URLは https のみ。危険URLはリンク/画像として描画しない
- 自動テスト: `safeUrl.test.ts`, `ResultCard.test.tsx`, `manualCardFactory.test.ts`, `e2e/core-flows.spec.ts`

## SEC-07 CSV formula injection

- 重大度: P0
- 状態: Protected
- 再現/期待結果: DATA-06参照

## SEC-08 依存パッケージ脆弱性

- 重大度: P0/P1
- 状態: Protected/Continuous
- 故障: 既知脆弱性を含む依存を販売物へ同梱
- 再現: `npm audit --audit-level=high`
- 期待結果: high以上0件。CI失敗時は販売ZIPを更新しない
- 自動テスト: `.github/workflows/ci.yml`

## SEC-09 MIME sniff / APIキャッシュ

- 重大度: P1
- 状態: Protected（本PRでnosniff追加）
- 故障: 中間層/ブラウザによる意図しない解釈・キャッシュ
- 再現: APIレスポンスヘッダー確認
- 期待結果: `Content-Type: application/json`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`
- 自動テスト: `functions/api/rakuten.test.ts`

## SEC-10 追加スキーム（data / blob / file / vbscript / プロトコル相対）

- 重大度: P0
- 状態: Protected
- 故障: javascript 以外の危険 URL でスクリプト実行やローカルファイル参照
- 再現: `data:`, `blob:`, `file:`, `vbscript:`, `//evil.example.com`
- 期待結果: リンク・画像として採用しない
- 自動テスト: `safeUrl.test.ts`

## SEC-11 検索ショートカット XSS / open redirect

- 重大度: P0
- 状態: Protected
- 故障: 検索語が href に生挿入される
- 再現: 特殊文字を含む検索語でショートカットを生成
- 期待結果: encode 済み https URL。`rel="noopener noreferrer"`
- 自動テスト: `searchLinkBuilder.test.ts`, `e2e/production-failure.spec.ts`

## SEC-12 CSP 未設定

- 重大度: P1
- 状態: Open / External
- 故障: もし XSS が1つでも残るとインライン script が動く
- 再現: 本番レスポンスヘッダーに CSP が無い
- 期待結果: 現状アプリ側では未設定。Cloudflare で `Content-Security-Policy` を検討（Google Fonts を許可する必要あり）
- 備考: React のテキスト描画と URL サニタイズが第一防御

## SEC-13 クリックジャッキング

- 重大度: P2
- 状態: Open / External
- 故障: 悪意サイトが iframe で本アプリを重ね、比較追加や履歴削除を誘導
- 再現: 外部ページから iframe で本番 URL を表示
- 期待結果: アプリコードでは未防止。Cloudflare で `X-Frame-Options: DENY` または `frame-ancestors 'none'` を推奨

## SEC-14 パス大文字小文字の取り違え

- 重大度: P1
- 状態: Protected
- 故障: `/API/rakuten` が Worker に載り、Origin 検査をバイパスした別実装になる
- 再現: `GET /API/rakuten?q=PS5`
- 期待結果: Worker は 404。`run_worker_first` は `/api/*`
- 自動テスト: `worker.test.ts`

---

# 販売前に必ず行う「故障注入」セット

以下は正式販売前に最低1回、Previewまたはテスト環境で実施する。

1. キー未設定 -> `mock_no_key`
2. 無効キー -> 実データ表示にならずフォールバック
3. upstream 429 -> `mock_rate_limited`
4. upstream 500 -> `mock_upstream_error`
5. 8秒以上応答なし -> timeout
6. `/api/rakuten`がHTMLを返す -> 画面クラッシュなし
7. 検索中に検索語変更 -> 旧結果が混ざらない
8. 検索中にデータソース変更 -> 旧結果が混ざらない
9. localStorage容量超過 -> 保存失敗が利用者へ分かる
10. localStorage破損 -> 白画面にならない（`e2e/core-flows.spec.ts`）
11. 別origin / same-site request -> 403
12. CLI連打 -> Cloudflare rate limitが働くこと（設定する場合）
13. CSV formula injection -> Excelで式実行されない
14. 375px実機/ブラウザ -> 横スクロールなし
15. 本番成果物secret scan -> Application IDなし
16. 履歴の HTML タイトル -> テキスト表示、alert なし
17. 複数タブで履歴保存 -> 他タブへ反映
18. USD × 為替0 -> 仕入れに 0円を入れない
19. `/api/rakuten/` 末尾スラッシュ -> ハンドラが応答

---

# 現時点の主要残リスク

正式販売判断で特に認識しておくべき未完了項目:

1. **公開 `/api/rakuten` のCLI濫用**: Origin検査だけでは完全防御できない。Cloudflare Rate Limiting/WAFを推奨。
2. **複数タブの同時書き込みマージ**: 他タブの更新は `storage` イベントで再読込するが、同時保存の3-way mergeはしない。
3. **https の外部画像URL**: ユーザーが貼った https 画像は読み込む（トラッキングピクセルになり得る）。javascript/http は拒否済み。
4. **CSP / クリックジャッキング**: アプリ側未設定。Cloudflare ヘッダーでの防御を推奨。
5. **比較ボード件数上限**: 重複 id は防ぐが件数キャップは無い。履歴は20件。

P0の公開プロキシ濫用対策だけは、本番Cloudflare設定時に必ず判断する。
