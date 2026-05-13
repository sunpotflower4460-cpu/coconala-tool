# Coconala Tool / Market Card Research App

> v0.1 Demo: サンプルデータと楽天APIモックで、検索・比較・CSV出力・履歴保存の主要フローを確認できるデモ版です。

物販・せどり・越境販売向けに、商品候補を画像つき価格カードで見やすく比較するリサーチ補助ツールです。

## Quick Start (v0.1 Demo)

Node.js 20 系を推奨します（`.nvmrc` 参照）。

```bash
npm install
npm run dev
npm run lint
npm run build
```

- デプロイ用ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`
- デプロイ後の確認: [`docs/post-deploy-qa.md`](docs/post-deploy-qa.md)

## Core Experience

ユーザーは難しいことを考えず、商品名・型番・JAN・URLのいずれかを入れて **まとめて探す** を押します。

最小条件は以下です。

- 画像が見える
- 価格が見える
- サイト名が見える
- 元URLに飛べる
- 比較に追加できる
- 送料・手数料・為替を含めた利益が見える

## Product Principle

このアプリは「完全自動スクレイピングツール」ではありません。

公式API、検索API、検索リンク生成、手動/URL追加を組み合わせて、規約リスクを抑えながら実務で使いやすい相場カード比較体験を作ります。

## Initial Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Zustand
- localStorage

将来的には API キー保護のため、Cloudflare Workers / Supabase Edge Functions / Next.js API Routes などを検討します。

## MVP Flow

```text
商品名を入れる
↓
まとめて探す
↓
画像つき価格カードが並ぶ
↓
気になるカードを比較に追加
↓
利益が見える
↓
元ページに飛べる
↓
必要なら手動で補える
↓
デザインも選べる
```

## Development Phases

See [`docs/phase-roadmap.md`](docs/phase-roadmap.md).

## Important Docs

- [`AGENTS.md`](AGENTS.md)
- [`COPILOT_INSTRUCTIONS.md`](COPILOT_INSTRUCTIONS.md)
- [`docs/setup-guide.md`](docs/setup-guide.md)
- [`docs/user-guide.md`](docs/user-guide.md)
- [`docs/manual-test-script.md`](docs/manual-test-script.md)
- [`docs/deployment-guide.md`](docs/deployment-guide.md)
- [`docs/post-deploy-qa.md`](docs/post-deploy-qa.md)
- [`docs/known-limitations.md`](docs/known-limitations.md)
- [`docs/buyer-handoff.md`](docs/buyer-handoff.md)
- [`docs/release-v0.1-checklist.md`](docs/release-v0.1-checklist.md)
- [`docs/release-notes-v0.1.md`](docs/release-notes-v0.1.md)
- [`docs/product-brief.md`](docs/product-brief.md)
- [`docs/data-source-policy.md`](docs/data-source-policy.md)
- [`docs/ux-principles.md`](docs/ux-principles.md)
- [`docs/coconala-package-plan.md`](docs/coconala-package-plan.md)
