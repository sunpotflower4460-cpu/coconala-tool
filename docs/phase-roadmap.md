# Phase Roadmap

## Phase 0: Design Foundation

Goal: Cloud Agent が迷わない設計憲法を置く。

Deliverables:

- README
- AGENTS.md
- COPILOT_INSTRUCTIONS.md
- product brief
- data source policy
- UX principles
- coconala package plan

Done when:

- Product direction is clear.
- Unsafe scraping direction is explicitly avoided.
- MVP flow is documented.

## Phase 1: UI Skeleton MVP

Goal: API未接続でも、ダミーデータで体験を完成させる。

Deliverables:

- Vite + React + TypeScript + Tailwind setup
- App shell
- Product search bar
- `まとめて探す` button
- Dummy market cards
- Compare board
- Profit panel
- Theme selector

Done when:

`商品名入力 -> まとめて探す -> カード表示 -> 比較に追加 -> 利益表示 -> テーマ切替` が動く。

## Phase 2: Data Model and Store

Goal: MarketCard を中心にデータ構造を固定する。

Deliverables:

- `MarketCard`
- `ResearchSession`
- `ProfitSettings`
- Zustand store
- localStorage persistence

## Phase 3: Manual / URL Add

Goal: APIなしでも実用できるライト版にする。

Deliverables:

- Manual add modal
- URL input
- Site detector
- Price / shipping / condition / memo fields
- Edit / delete cards

## Phase 4: Search Link Generation

Goal: メルカリ・ヤフオク・Googleなどを一発で開けるようにする。

Deliverables:

- Google search link
- Google image search link
- Mercari search link
- Yahoo Auctions search link
- Rakuma search link
- Search shortcut cards

## Phase 5: Profit Calculator

Goal: 仕入れ判断ができるようにする。

Deliverables:

- Buy/sell price selection
- Shipping
- Fee rate
- Exchange rate
- Estimated profit
- Profit margin
- Badges: 狙い目 / 要確認 / 利益薄い

## Phase 6: Official API Adapters

Goal: 公式APIで取れるものを自動カード化する。

Priority:

1. eBay Browse API
2. Yahoo Shopping API
3. Rakuten API
4. Exchange API

## Phase 7: Search API Cards

Goal: Brave Search API などから検索結果由来カードを作る。

Notes:

- Always label as `検索表示から推定`.
- Do not guarantee price accuracy.
- Preserve original URL.

## Phase 8: Design Themes

Goal: ココナラで売れる見た目に仕上げる。

Themes:

- Simple Pro
- Soft Market
- Dark Trader
- Natural Board

## Phase 9: AI Comments

Goal: 型番違い・付属品・価格差・利益薄さなどを短くコメントする。

Notes:

- Do not overclaim.
- Keep comments short and practical.

## Phase 10: Coconala Delivery Package

Goal: 販売・納品しやすい状態にする。

Deliverables:

- setup guide
- user guide
- API key guide
- delivery checklist
- coconala service text
- sample data
- CSV export
