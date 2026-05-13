# AGENTS.md

このリポジトリで作るアプリは、ココナラ販売も意識した **相場カードリサーチアプリ** です。

## Golden Goal

ユーザーが難しいことを考えずに、商品名・型番・JAN・URLから価格候補を見つけ、画像つきカードで比較し、利益見込みまで見られる状態を作る。

## Non-Negotiable Principles

1. **見える・比べられる・飛べる・利益が分かる** を最優先する。
2. 完全自動スクレイピングツールにしない。
3. 公式APIで取れるものは自動取得する。
4. メルカリ・ヤフオク・Google系は、検索リンク生成・検索API候補・URL追加・共有/拡張機能によるユーザー操作補助を中心に扱う。
5. 検索結果由来の価格は `検索表示から推定` と表示し、断定しない。
6. APIキーや秘密情報をフロントエンドに固定値として書かない。
7. 初心者にも分かる UI を優先し、API・スクレイピング・パーサーなどの裏事情を表画面に出しすぎない。
8. ココナラ納品を想定し、README・使い方・設定方法を常に整える。

## UX Tone

- ボタン名は「まとめて探す」「比較に追加」「元ページを見る」など、直感的にする。
- テーブルより先にカードで見せる。
- 専門用語より、ユーザーが欲しい判断を出す。
- デザインテーマを選べるようにし、業務ツールでも味気なくしない。

## Initial Technical Direction

- Vite + React + TypeScript
- Tailwind CSS
- Zustand
- localStorage
- Later: Cloudflare Workers / Supabase Edge Functions / Next.js API Routes for protected API calls

## Recommended Work Order

1. UI Skeleton with dummy data
2. Data model and Zustand store
3. Manual / URL add
4. Search link generation
5. Profit calculator
6. Official API adapters
7. Search API cards
8. Themes
9. AI comments
10. Coconala delivery package

## Safety / Policy Guardrails

- Do not add code that bypasses site access controls.
- Do not implement high-volume scraping of Mercari, Yahoo Auctions, Google, or similar services.
- Do not promise exact price accuracy for search-result-derived cards.
- Always label source type: `official_api`, `search_api`, `search_link`, or `manual`.
- Keep a clear path for users to open original URLs and verify.
