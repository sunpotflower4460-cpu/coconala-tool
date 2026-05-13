# COPILOT_INSTRUCTIONS.md

## Project Identity

This is a market-card research app for resale, product research, and cross-border selling workflows. The main deliverable is not a raw scraper. It is an easy, visual comparison board where users can see product images, prices, source sites, URLs, and profit estimates.

## Build Style

- Prefer small, typed, composable React components.
- Keep business logic in `src/features/*` or `src/services/*`, not inside large components.
- Use TypeScript types as the backbone of the app.
- Use accessible, mobile-friendly UI.
- Keep the MVP beautiful enough for screenshots.
- Avoid overengineering before the card comparison flow works.

## User-Facing Flow

1. User enters a product name, model number, JAN, or URL.
2. User clicks `まとめて探す`.
3. Cards appear with image, price, site, source label, and original URL.
4. User adds interesting cards to comparison.
5. Profit estimate appears.
6. User can open the original listing/search result.
7. User can manually add missing results.
8. User can choose a visual theme.

## Source Labels

Every card must have one of these source types:

- `official_api`: official marketplace API result
- `search_api`: general search API-derived result
- `search_link`: link to a generated search URL
- `manual`: user-entered result

Search-derived values must not be presented as guaranteed prices.

## Important UX Copy

Use simple Japanese labels:

- `まとめて探す`
- `比較に追加`
- `元ページを見る`
- `手動で追加`
- `検索表示から推定`
- `公式API取得`
- `手動追加`
- `利益見込み`
- `要確認`

## Avoid

- Do not hard-code API keys.
- Do not add high-volume scraping.
- Do not hide uncertainty when prices are inferred.
- Do not build a dense dashboard before the core card flow is smooth.
- Do not add login, billing, or heavy backend in the first MVP unless explicitly requested.

## Preferred Folder Shape

```text
src/
  components/
  features/
    compare/
    manualAdd/
    profit/
    search/
    themes/
  services/
    marketAdapters/
    searchApi/
  store/
  types/
  utils/
  data/
  theme/
```

## Definition of Done for Early MVP

The app is acceptable when dummy data proves this loop:

`商品名入力 -> まとめて探す -> 価格カード表示 -> 比較に追加 -> 利益表示 -> テーマ切替`.
