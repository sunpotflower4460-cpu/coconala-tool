# 納品物の中身

`npm run verify:all`（または `npm run delivery:package`）で `dist-delivery/納品ファイル-v{version}/` に、購入者へ送る5ファイルを生成します。
ココナラのトークルームは1回200MBまでのため、各ファイルを200MB未満にしています（`delivery:verify` が検証）。

```text
納品ファイル-v{version}/
├─ ①アプリ（Windows用）.exe                 Windows 用インストーラー（electron-builder・NSIS）
├─ ①アプリ（Mac・Appleシリコン用）.dmg       Mac 用（arm64）
├─ ①アプリ（Mac・Intel用）.dmg               Mac 用（x64）
├─ ②マニュアル.pdf                           画面写真入りのかんたん操作マニュアル（scripts/marketing/manual.spec.ts がアプリを起動して毎回撮り直す）
└─ ③詳しい資料（公開・改造する人向け）.zip
   └─ ③詳しい資料（公開・改造する人向け）/
      ├─ README_FIRST.md      最初に読む案内（docs/README_FIRST.md）
      ├─ ②マニュアル.pdf      上と同じもの
      ├─ ブラウザ版（自動取得なし）.html  ダブルクリックで動く1ファイル版（scripts/build-local-html.mjs）
      ├─ QUICK_START.md / USER_GUIDE.md / DEPLOY_GUIDE.md / SUPPORT_POLICY.md / PRIVACY_AND_DATA.md / TERMS.md / CHANGELOG.md
      ├─ QUALITY_REPORT.md    納品前に自動実行した品質チェックの結果
      ├─ app-static/          ビルド済みの Web 版（自動取得なし）
      ├─ source/              ソースコード一式（デスクトップアプリ・Web 版）
      ├─ sample/              画面の見本画像
      └─ checksums.txt        ③の中の各ファイルの SHA-256
```

5ファイルの SHA-256 は `dist-delivery/納品ファイル-v{version}.sha256.txt` に出力します（販売者の控え）。

③の中の文書の相対リンクは、ZIPの構成に合わせて自動で書き換えます（例: `setup-guide.md` → `source/docs/setup-guide.md`）。

## `source/` に含めるもの（許可リスト・Git 管理下のファイルのみ）

- `src/`, `functions/`, `e2e/`（偽の楽天APIを含む）, `public/`
- デスクトップ版: `electron/`, `e2e-desktop/`, `build-resources/`, `electron-builder.yml`, `playwright.desktop.config.ts`, `tsconfig.electron.json`, `scripts/build-desktop.mjs`
- `package.json`（販売者用の `delivery:*` / `verify:*` / `marketing:*` スクリプトは除去）, `package-lock.json`
- `index.html`, `vite.config.ts`, `playwright.config.ts`, `vitest.setup.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`
- `wrangler.jsonc`, `worker.ts`, `worker.test.ts`
- `.env.example`, `.gitignore`, `.nvmrc`, `.node-version`
- `README.md`（販売者向けの節を除去）, `TERMS.md`, `CHANGELOG.md`
- `docs/` の購入者向け文書のみ: README_FIRST, QUICK_START_BUYER, user-guide, deployment-guide, setup-guide, post-deploy-qa,
  known-limitations, buyer-handoff, SUPPORT_POLICY, PRIVACY_AND_DATA

## 含めないもの

- `.env*`（`.env.example` を除く）、`.dev.vars*`、`node_modules/`、ビルド成果物、`.git/`、`.github/`
- 開発AI向け・販売者向けの内部資料（`AGENTS.md`、`COPILOT_INSTRUCTIONS.md`、`docs/MANUAL_STEPS_SALES.md`、
  `docs/coconala-listing-copy.md`、`docs/PRODUCTION_FAILURE_RISK_MATRIX.md`、`docs/qa-checklist.md` など）、`docs/archive/`、`docs/adr/`
- `scripts/`（納品物生成・検証用。デスクトップ版のビルドに使う `scripts/build-desktop.mjs` だけは含める）

## 生成時の自動チェック（1つでも失敗したら納品ファイルを作らない）

- README・CHANGELOG のバージョンが `package.json` と一致
- 文書のリンク切れ・見出しアンカー切れが無い（納品物に無いファイルへのリンクも不可）
- 秘密情報らしき値（キー代入・既知のトークン形式・URL直書きのキー・手元の `.env` / `.dev.vars` と同じ値）が無い
- 品質レポート（`QUALITY_REPORT.md`）・マニュアル・3つのインストーラーが同じバージョンで生成済み、各ファイルが200MB未満

## 生成後の自動検証（`npm run delivery:verify`）

購入者と同じ立場で次を確認します。

- 5ファイルがそろい、各200MB未満で、SHA-256 の一覧と一致する。Windows 用は実行ファイル形式、Mac 用 dmg は `hdiutil verify` で壊れていない
- 作ったアプリ（インストーラーと同じビルド）がこの Mac で起動し、画面・キー保管・/api が動く

③の ZIP を一時フォルダへ展開し、次を確認します。

- 必須ファイルがあり、含めてはいけないファイルが無い / checksums.txt と一致 / リンク切れ・秘密情報が無い
- `source/` だけで `npm ci` → 型チェック → 単体テスト → 本番ビルド → `wrangler deploy --dry-run` が通る
- `app-static/` をブラウザで開き、検索→比較→利益→CSV （自動取得なしを明示し、偽の商品は出さない。価格入力→比較→利益→CSV）が動く（PC・iPhone 相当）
