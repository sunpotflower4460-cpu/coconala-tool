# 納品ZIPの中身

`npm run delivery:package`（内部で `scripts/create-delivery-package.mjs` を実行）で生成する
`相場カード比較ボード-v{version}.zip`（出力先: `dist-delivery/`）の構成です。

```text
相場カード比較ボード-v{version}/
├─ README_FIRST.md      最初に読むファイル（README.md のコピー）
├─ QUICK_START.md        購入者向けクイックスタート（docs/QUICK_START_BUYER.md のコピー）
├─ USER_GUIDE.md         操作ガイド（docs/user-guide.md のコピー）
├─ TERMS.md              利用規約・ライセンス
├─ SUPPORT_POLICY.md     サポート範囲・期間
├─ CHANGELOG.md          変更履歴
├─ source/               ソースコード一式（開発用ファイルを除く）
├─ sample/                商品画像・操作動画の配置用フォルダ（納品前に手動で追加）
└─ checksums.txt          各ファイルのSHA-256チェックサム一覧
```

## `source/` に含まれるもの

- `src/`, `functions/`, `e2e/`, `public/`（存在する場合）
- `package.json`, `package-lock.json`
- `index.html`, `vite.config.ts`, `playwright.config.ts`, 各種 `tsconfig*.json`
- `tailwind.config.js`, `postcss.config.js`
- `.env.example`, `.nvmrc`
- `README.md`, `TERMS.md`, `CHANGELOG.md`
- `docs/`（下記「`source/` から除外するもの」に記載したものを除く）

## `source/` から除外するもの（自動）

- `.git/`, `.github/`
- `node_modules/`, `dist/`, `test-results/`, `playwright-report/`
- `.env`, `.dev.vars`（実際のシークレット値）
- 開発AI向けの内部指示書: `AGENTS.md`, `COPILOT_INSTRUCTIONS.md`
- 開発プロセス向けの内部設計書: `docs/product-brief.md`, `docs/data-source-policy.md`,
  `docs/ux-principles.md`, `docs/phase-roadmap.md`
- 出品者向け・社内向けドキュメント: `docs/coconala-listing-copy.md`, `docs/qa-checklist.md`,
  `docs/release-v1-checklist.md`, `docs/manual-test-script.md`, `docs/MANUAL_STEPS_SALES.md`,
  `docs/adr/`
- 過去バージョンの記録: `docs/archive/`
- このスクリプト自身と納品物生成の一時ファイル: `scripts/`, `dist-delivery/`

## 自動チェック（生成前に失敗したら停止する）

- `README.md` のバージョン表記が `package.json` の `version` と一致している
- `package-lock.json` が存在する
- `.env.example` が存在する
- `.env` / `.dev.vars` がステージング対象に含まれていない
- ステージング済みファイルに既知のシークレットパターン（APIキーらしき値等）が含まれていない

いずれかに失敗した場合、ZIPは生成されません（不完全な納品物を誤って作らないため）。

## `sample/` フォルダについて

商品画像・操作動画は Claude Code が自動生成しません（`docs/MANUAL_STEPS_SALES.md` 参照）。
スクリプトは空の `sample/` フォルダと案内用の `README.md` を生成するので、実際の画像・動画は
納品前に手動で追加してください。
