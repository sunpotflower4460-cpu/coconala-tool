# 販売開始までに人が行う作業

コード・テスト・文書・納品ZIPの作成と検証は `npm run verify:all` で自動化されています（結果: `dist-delivery/VERIFICATION_REPORT.md`）。
ここに残っているのは、アカウント・実キー・実機・お金と規約の判断など、**人にしかできない作業だけ**です。

## 1. 自動チェックを実行する（10分程度・放置でよい）

```bash
npm ci
npx playwright install chromium webkit   # 初回のみ
npm run verify:all                        # すべての自動チェック＋マニュアル・画面写真・インストーラー＋納品ファイル生成と検証（Mac で実行）
```

- [ ] `dist-delivery/VERIFICATION_REPORT.md` の結果がすべて PASS

## 2. デモ環境を公開して実データで1回確認する（アカウント・実キーが必要）

- [x] 楽天ウェブサービスで新しいアプリを登録し、アプリIDとアクセスキーを取得・登録（2026-09-25 完了。有効期限 2027-09-25）
- [ ] Yahoo!デベロッパーネットワークで Client ID を取得し `npx wrangler secret put SERVER_YAHOO_CLIENT_ID`
- [ ] eBay Developers Program で Production の App ID / Cert ID を取得し `SERVER_EBAY_CLIENT_ID` / `SERVER_EBAY_CLIENT_SECRET` を登録
- [ ] `npm run deploy`
- [ ] `E2E_BASE_URL=<デモURL> npm run e2e:postdeploy` がすべて passed
- [ ] デモURLでデータソース「まとめて」にして1回検索し、3サイトの件数と実際の商品が出る（[`post-deploy-qa.md`](post-deploy-qa.md)）
- [ ] 手持ちのスマホでデモURLを開き、検索と「比較に追加」ができる

## 2-2. デスクトップアプリを実機で1回確かめる

- [ ] 楽天の実キーで、アプリの「設定」→ 楽天市場 →「保存してテスト」が「使えます」になる（楽天の「許可されたWebサイト」に `coconala-tool.sunpotflower4460.workers.dev` が入っていること）
- [ ] 「まとめて探す」で、右側のタブにメルカリ・ヤフオク・ラクマ・Amazon の本物の検索ページが開き、「値段を取り込む」で件数が出る
- [ ] Windows のパソコンで1回インストールして起動する（手元に無ければ知人に依頼。GitHub の Windows 環境では自動で起動確認済み）
- [ ] Apple シリコンの Mac で1回起動する（GitHub の Apple シリコン環境では自動で起動確認済み）

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
- [ ] 納品時は `dist-delivery/納品ファイル-v1.0.0/` の5ファイルをトークルームで送る（1回200MBまでのため、インストーラーは1通に1つずつ）。中身の目視確認は不要（`delivery:verify` が確認済み）

---

このファイルは購入者向け納品物には含まれません。
