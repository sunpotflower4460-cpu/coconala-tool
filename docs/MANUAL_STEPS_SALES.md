# 販売開始までに人が行う作業

コード・テスト・文書・納品ZIPの作成と検証は `npm run verify:all` で自動化されています（結果: `dist-delivery/VERIFICATION_REPORT.md`）。
ここに残っているのは、アカウント・実キー・実機・お金と規約の判断など、**人にしかできない作業だけ**です。

## 1. 自動チェックを実行する（10分程度・放置でよい）

```bash
npm ci
npx playwright install chromium webkit   # 初回のみ
npm run marketing:capture                 # 出品用の画面写真・操作動画の下書き
npm run verify:all                        # すべての自動チェック＋納品ZIP生成＋ZIP検証
```

- [ ] `dist-delivery/VERIFICATION_REPORT.md` の結果がすべて PASS

## 2. デモ環境を公開して実データで1回確認する（アカウント・実キーが必要）

- [ ] 楽天ウェブサービスで新しいアプリを登録し、アプリIDとアクセスキーを取得（許可されたWebサイト＝デモの公開URL）
- [ ] `npx wrangler login` → `npm run deploy` → `npx wrangler secret put SERVER_RAKUTEN_APP_ID` / `SERVER_RAKUTEN_ACCESS_KEY`
- [ ] `E2E_BASE_URL=<デモURL> npm run e2e:postdeploy` がすべて passed
- [ ] デモURLで楽天市場モードにして1回検索し、緑の「実データ表示中」と実際の商品が出る（[`post-deploy-qa.md`](post-deploy-qa.md)）
- [ ] 手持ちのスマホでデモURLを開き、検索と「比較に追加」ができる

## 3. 出品物を仕上げる

- [ ] `dist-delivery/marketing/` の画面写真から出品画像を選ぶ（必要なら文字入れ）
- [ ] `dist-delivery/marketing/` の操作動画（下書き）を確認し、必要ならナレーション・編集
- [ ] [`coconala-listing-copy.md`](coconala-listing-copy.md) を最終確認し、ココナラの出品フォームへ転記。デモURLを記載

## 4. ビジネス上の判断

- [ ] 各プランの価格を決める
- [ ] 返金・キャンセル方針を決め、出品ページに記載する
- [ ] [`TERMS.md`](../TERMS.md) を最終確認する（出品者情報の追記が必要か含む）
- [ ] ココナラの出品者プロフィール・本人確認を済ませる
- [ ] リポジトリを private にするか決める

## 5. 販売開始

- [ ] `package.json` のバージョンを `1.0.0` にし、README・CHANGELOG・販売文・リスク表の表記をそろえて `npm run verify:all`
- [ ] `v1.0.0` タグを付ける
- [ ] 納品時は `dist-delivery/相場カード比較ボード-v1.0.0.zip` を渡す（中身の目視確認は不要。`delivery:verify` が展開・再ビルドまで確認済み）

---

このファイルは購入者向け納品物には含まれません。
