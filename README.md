# 相場カード比較ボード / Market Card Board

物販・せどり向けの相場リサーチ補助ツールです。楽天市場 公式APIの価格候補、他サイトへの検索リンク、手動追加した商品を一つのボードで比較し、利益見込み・履歴・CSV出力までまとめて管理できます。

現在のバージョン: **v0.9.0-rc.3**（正式販売前の候補版）

---

## このREADMEの読み方

- **購入・導入を検討している方** → 「対応データソース」「デプロイ先ごとの対応範囲」を先に読んでください。セットアップは [`docs/setup-guide.md`](docs/setup-guide.md)、引き渡し後の運用は [`docs/buyer-handoff.md`](docs/buyer-handoff.md) にまとめています。
- **開発・カスタマイズする方** → 「Quick Start」以降と `docs/` 配下の各ガイドを参照してください。

---

## 対応データソース（誇張なし）

| ソース | 状態 | 説明 |
|---|---|---|
| 楽天市場 商品検索API | ✅ 公式API対応 | サーバー側（Cloudflare Pages Functions）に `SERVER_RAKUTEN_APP_ID` を設定すると実データ（`公式API取得`）に切り替わります。 |
| メルカリ・ヤフオク・eBay・Yahoo!ショッピング 等 | 検索リンク＋手動追加 | 自動取得はしません。検索リンクを開いてユーザーが確認・手動追加する運用です。 |
| サンプルデータ | デモ用 | UI・操作フロー確認用の固定データです。 |
| モック（楽天API想定） | デモ用 | 楽天キー未設定・通信失敗・レート超過時に自動フォールバックする擬似データです。 |

「全サイト完全自動取得」「最安値保証」のような機能はありません。表示価格は確定価格ではなく、必ず元ページでの確認を前提としています。

## デプロイ先ごとの対応範囲

| デプロイ先 | 静的UI | 楽天API連携 |
|---|---|---|
| Cloudflare Pages（推奨・正式対応） | ✅ | ✅ Pages Functions で対応済み |
| Vercel | ✅ | ❌ 別途 Function 実装が必要（未実装） |
| GitHub Pages | ✅（静的デモのみ） | ❌ サーバーサイド機能が使えないため非対応 |

詳細手順は [`docs/deployment-guide.md`](docs/deployment-guide.md) を参照してください。

## Quick Start

Node.js 20 LTS を推奨します（`.nvmrc` 参照。22 でも動作しますが基準は 20 LTS）。

```bash
npm ci          # lockfile に固定されたバージョンを再現インストール
npm run dev
npm run lint    # 型チェック（tsc -b）
npm run build
npm run test    # 利益計算 / CSV出力の回帰テスト（Vitest）
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

公式API、検索リンク生成、手動/URL追加を組み合わせて、規約リスクを抑えながら実務で使いやすい相場カード比較体験を作ります。API障害時にモックへフォールバックした場合は、その事実を画面上に隠さず表示します。

## Initial Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Zustand
- localStorage
- Cloudflare Pages Functions（楽天APIプロキシ）

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

## License / Terms

ライセンスと利用範囲（商用利用可・再販/再配布の制限・保証なし）は [`TERMS.md`](TERMS.md) を参照してください。

`package.json` の `"private": true` は npm へ公開しない設定です（社内/納品用であり、npm レジストリに publish されません）。ソースコードの納品・利用そのものを制限するものではありません。

## Development Phases

See [`docs/phase-roadmap.md`](docs/phase-roadmap.md).

## Important Docs

### 購入者向け

- [`docs/buyer-handoff.md`](docs/buyer-handoff.md)
- [`docs/setup-guide.md`](docs/setup-guide.md)
- [`docs/user-guide.md`](docs/user-guide.md)
- [`docs/deployment-guide.md`](docs/deployment-guide.md)
- [`docs/post-deploy-qa.md`](docs/post-deploy-qa.md)
- [`docs/known-limitations.md`](docs/known-limitations.md)
- [`docs/coconala-listing-copy.md`](docs/coconala-listing-copy.md)

### 開発者向け

- [`AGENTS.md`](AGENTS.md)
- [`COPILOT_INSTRUCTIONS.md`](COPILOT_INSTRUCTIONS.md)
- [`docs/manual-test-script.md`](docs/manual-test-script.md)
- [`docs/qa-checklist.md`](docs/qa-checklist.md)
- [`docs/release-v1-checklist.md`](docs/release-v1-checklist.md)
- [`docs/product-brief.md`](docs/product-brief.md)
- [`docs/data-source-policy.md`](docs/data-source-policy.md)
- [`docs/ux-principles.md`](docs/ux-principles.md)
- [`CHANGELOG.md`](CHANGELOG.md)

過去バージョンの計画書・リリースノートは [`docs/archive/`](docs/archive/) にまとめています。
