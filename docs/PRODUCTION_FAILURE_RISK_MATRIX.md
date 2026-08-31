# 本番故障リスク・再現テストマトリクス

最終更新: 2026-09-01

対象: 相場カード比較ボード (`coconala-tool`)

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

## API-05 200だがJSON破損 / `items`契約違反

- 重大度: P0
- 状態: Protected（本PRでフロント契約検査を強化）
- 故障: API仕様変更やEdge誤配信を「検索結果0件」と誤認し、利用者に間違った判断をさせる
- 再現:
  1. Content-TypeはJSONだが `json()` がSyntaxError
  2. HTTP 200で `{ status: 'ok' }` のみ返す
- 期待結果: `mock_upstream_error` へフォールバックし、「0件」とは表示しない
- 自動テスト: `src/services/marketAdapters/rakutenAdapter.test.ts`

## API-06 楽天商品データの必須フィールド欠落 / 不正URL / 負価格

- 重大度: P1
- 状態: Protected
- 故障: 壊れたカード、危険なURL、異常な利益計算
- 再現: itemCodeなし、itemNameなし、HTTP画像/商品URL、負価格を含むItems
- 期待結果: 必須フィールド欠落カードは除外。URLはHTTPSのみ。負価格は0へ正規化
- 自動テスト: `functions/api/rakuten.test.ts`

## API-07 巨大な上流レスポンス

- 重大度: P2
- 状態: Partial
- 故障: JSON parse時のメモリ/CPU増大
- 再現: テスト環境で数MB〜数十MB相当のItemsを返す
- 期待結果: Functionsの制限内で失敗しても502/モックへ倒れ、秘密情報を返さない
- 自動化: 未実装。楽天API自体がhits上限30のため実リスクは低いが、プロキシ契約試験として残す

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

---

# 4. 同時実行・競合

## CONC-01 検索ボタン連打 / Enter連打

- 重大度: P1
- 状態: Protected
- 故障: 同じAPIを二重送信し、レート枠消費・状態競合
- 再現: 検索開始直後にボタンを再クリック
- 期待結果: `isSearching`中は2回目を送らない
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-02 検索中に検索語を変更

- 重大度: P0
- 状態: Protected（本PR追加）
- 故障: 画面の検索語はNintendoなのに、遅れて返ったPS5カードが表示される
- 再現: PS5検索開始 -> 応答前に入力をNintendoへ変更 -> PS5応答をresolve
- 期待結果: 旧応答は破棄。現在クエリと結果を混在させない
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-03 検索中にデータソース切替

- 重大度: P0
- 状態: Protected（本PR追加）
- 故障: 「楽天市場」表示なのにサンプル検索結果が後着して表示される
- 再現: sample検索開始 -> 応答前にrakutenへ切替 -> sample応答をresolve
- 期待結果: 旧モード応答は破棄
- 自動テスト: `ProductSearchBar.test.tsx`

## CONC-04 検索中にクリア/リセット

- 重大度: P1
- 状態: Protected（CONC-02の同じガードで防御）
- 故障: ユーザーが消した直後に結果が復活
- 再現: 検索開始 -> Xでクリア -> 応答到着
- 期待結果: 結果を復活させない
- 自動テスト: CONC-02と同じ状態不一致ガード。専用E2E追加は任意

## CONC-05 同じアプリを複数タブで開き、両方から履歴保存/削除

- 重大度: P1
- 状態: Open
- 故障: localStorageのlast-write-winsで別タブの更新を上書き
- 再現: Tab A/Bを開く -> A保存 -> B保存/削除 -> 再読込
- 期待結果（現状目標）: データ消失が起き得るため、正式仕様として「同時に複数タブで編集しない」を明記するか、storage event同期/競合解決を実装
- 手動テスト: 本番ブラウザ2タブ

---

# 5. データ不整合・永続化

## DATA-01 localStorage容量超過

- 重大度: P1
- 状態: Partial
- 故障: 保存ボタンを押したのに再読込後に履歴が消える
- 再現: `localStorage.setItem`をQuotaExceededErrorにする
- 期待結果: 「保存に失敗」と表示し、成功扱いしない
- 自動テスト: `historyStore.test.ts`で永続化失敗検知。UIのエラー表示は手動/E2Eで確認
- 既知事項: in-memory一覧には一時的に保存済み項目が見える可能性があるため改善余地あり

## DATA-02 ブラウザでStorage利用が禁止

- 重大度: P1
- 状態: Partial
- 故障: SecurityErrorでアプリ全体が落ちる/履歴保存を成功扱いする
- 再現: localStorage getterをthrowさせる
- 期待結果: アプリ主要機能は継続。履歴保存は失敗表示
- 自動テスト: `historyStore.test.ts`（検知関数）

## DATA-03 localStorage JSONが手動編集/破損

- 重大度: P1
- 状態: Open
- 故障: Zustand hydration時に不正値・古い構造が混入し、画面クラッシュや誤計算
- 再現: DevTools Applicationで `coconala-tool-research` / `coconala-tool-history` を壊れたJSONや型違いへ変更してreload
- 期待結果: 既定値へフォールバックし、画面をクラッシュさせない。将来はversion/migrate/schema validationを追加する
- 販売判定: 少なくとも壊れたJSONで白画面にならないことを手動確認

## DATA-04 将来バージョンで保存形式を変更

- 重大度: P1
- 状態: Open
- 故障: アップデート後に旧履歴が読めない
- 再現: 現行localStorageスナップショットを保存 -> schema変更版で起動
- 期待結果: persist version/migrateを導入するまでは破壊的変更をしない。変更時はmigration test必須

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
- 状態: Open
- 故障: UI性能低下、localStorage容量圧迫
- 再現: 数十万文字をフォームへ貼付
- 期待結果: 将来maxLengthを設定。現状は購入者向けに通常の情報量での利用を前提とする

## USER-04 同一URLを複数回手動追加

- 重大度: P2
- 状態: Protected/Intentional
- 故障: 比較カード重複による誤操作
- 再現: 同URLを2回入力
- 期待結果: 警告を表示。ただし別価格/状態の記録需要があるため追加自体は禁止しない
- QA: `docs/qa-checklist.md`

## USER-05 履歴削除を誤クリック

- 重大度: P2
- 状態: Open
- 故障: 元に戻せない履歴削除
- 再現: 履歴の削除をクリック
- 期待結果: 現状即削除。販売後の問い合わせで頻発する場合は確認ダイアログ/Undoを追加

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

## SEC-05 外部リンクのreverse tabnabbing

- 重大度: P1
- 状態: Protected
- 故障: 新規タブから元画面の`window.opener`を操作
- 再現: 元ページリンクを開く
- 期待結果: `target=_blank`には`rel="noopener noreferrer"`
- コード確認: `ResultCard.tsx`等

## SEC-06 手動画像URLによる外部トラッキング/混在コンテンツ

- 重大度: P2
- 状態: Open
- 故障: 手動追加した画像URLへブラウザがアクセスし、第三者へIP/Referer等が渡る。HTTP画像はHTTPSページでブロックされる可能性
- 再現: 自前サーバー画像URLを手動追加してnetwork確認
- 期待結果: 購入者が入力した外部画像であることを理解できる。将来はHTTPS限定/画像非表示設定を検討

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
10. localStorage破損 -> 白画面にならない（現状Open。販売前に手動確認）
11. 別origin / same-site request -> 403
12. CLI連打 -> Cloudflare rate limitが働くこと（設定する場合）
13. CSV formula injection -> Excelで式実行されない
14. 375px実機/ブラウザ -> 横スクロールなし
15. 本番成果物secret scan -> Application IDなし

---

# 現時点の主要残リスク

正式販売判断で特に認識しておくべき未完了項目:

1. **公開 `/api/rakuten` のCLI濫用**: Origin検査だけでは完全防御できない。Cloudflare Rate Limiting/WAFを推奨。
2. **複数タブ同時編集**: localStorageのlast-write-wins競合が残る。単一タブ運用を明記するか同期処理を追加。
3. **破損/旧localStorageのschema validation**: persist version/migrationがまだ無い。アップデートで保存形式を壊さないこと。
4. **極端に長い手動入力**: 検索語は100文字へ制限したが、手動タイトル/メモ等は上限未設定。
5. **手動画像URL**: 外部画像ロードによるプライバシー/混在コンテンツリスク。

これらは「今すぐ全て機能追加する」より、販売スコープと運用に合わせて優先順位を決める。P0の公開プロキシ濫用対策だけは、本番Cloudflare設定時に必ず判断する。
