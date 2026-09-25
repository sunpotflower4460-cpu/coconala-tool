# 納品ZIPの中身

`npm run verify:all`（または `npm run delivery:package`）で `dist-delivery/相場カード比較ボード-v{version}.zip` を生成します。

```text
相場カード比較ボード-v{version}/
├─ ①ツールを開く.html     ダブルクリックで動く1ファイル版（静的版の JS・CSS をすべて埋め込み。scripts/build-local-html.mjs）
├─ ②マニュアル.pdf         画面写真入りの操作・導入マニュアル（scripts/marketing/manual.spec.ts が毎回撮り直して生成）
└─ ③詳しい資料（公開する人向け）/
   ├─ README_FIRST.md      最初に読む案内（docs/README_FIRST.md）
   ├─ QUICK_START.md / USER_GUIDE.md / DEPLOY_GUIDE.md / SUPPORT_POLICY.md / PRIVACY_AND_DATA.md / TERMS.md / CHANGELOG.md
   ├─ QUALITY_REPORT.md    納品前に自動実行した品質チェックの結果
   ├─ app-static/          ビルド済みの静的版（サーバーに置いて公開する用）
   ├─ source/              ソースコード一式（Workers 版の公開・改造用）
   ├─ sample/              画面の見本画像
   └─ checksums.txt        ZIP 全体の各ファイルの SHA-256（パスは ZIP の一番上から）
```

初心者が迷わないよう、ZIP を開いて最初に見えるのは①②③の3つだけにしています（`delivery:verify` が検証）。

③の中の文書の相対リンクは、ZIPの構成に合わせて自動で書き換えます（例: `setup-guide.md` → `source/docs/setup-guide.md`）。

## `source/` に含めるもの（許可リスト・Git 管理下のファイルのみ）

- `src/`, `functions/`, `e2e/`（偽の楽天APIを含む）, `public/`
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
- `scripts/`（納品物生成・検証用）

## 生成時の自動チェック（1つでも失敗したら ZIP を作らない）

- README・CHANGELOG のバージョンが `package.json` と一致
- 文書のリンク切れ・見出しアンカー切れが無い（納品物に無いファイルへのリンクも不可）
- 秘密情報らしき値（キー代入・既知のトークン形式・URL直書きのキー・手元の `.env` / `.dev.vars` と同じ値）が無い
- 品質レポート（`QUALITY_REPORT.md`）が同じバージョンで生成済み

## 生成後の自動検証（`npm run delivery:verify`）

ZIP を一時フォルダへ展開し、購入者と同じ立場で次を確認します。

- 必須ファイルがあり、含めてはいけないファイルが無い / checksums.txt と一致 / リンク切れ・秘密情報が無い
- `source/` だけで `npm ci` → 型チェック → 単体テスト → 本番ビルド → `wrangler deploy --dry-run` が通る
- `app-static/` をブラウザで開き、検索→比較→利益→CSV が動き、楽天市場は見本データと明示される（PC・iPhone 相当）
