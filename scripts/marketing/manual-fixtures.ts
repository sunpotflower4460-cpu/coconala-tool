import type { Page, Route } from '@playwright/test';

/**
 * マニュアル用の画面写真を撮るための、実在しない商品データ（ブラウザ内で /api/* の応答を差し替える）。
 * 実在の店舗名・商品ページは使わない。画像もブラウザ内で作る（外部通信なし）。
 */
const QUERY_LABEL = 'ワイヤレスイヤホン';

const img = (label: string, color: string) =>
  `https://placehold.co/300x200/${color}/ffffff?text=${encodeURIComponent(label)}`;

const rakutenItems = [
  { itemCode: 'demo-shop-a:1', itemName: 'ワイヤレスイヤホン ノイズキャンセリング Bluetooth5.3 ブラック', shopName: 'サンプル家電 楽天市場店', itemPrice: 12980, mediumImageUrls: [{ imageUrl: img('Earbuds A', '1e3a8a') }], itemUrl: 'https://item.rakuten.co.jp/demo-shop-a/1/', postageFlag: 0 },
  { itemCode: 'demo-shop-b:2', itemName: 'ワイヤレスイヤホン 完全ワイヤレス 外音取り込み ホワイト', shopName: 'デモオーディオ', itemPrice: 14800, mediumImageUrls: [{ imageUrl: img('Earbuds B', '1d4ed8') }], itemUrl: 'https://item.rakuten.co.jp/demo-shop-b/2/', postageFlag: 1 },
  { itemCode: 'demo-shop-c:3', itemName: 'ワイヤレスイヤホン 専用ケース カバー 保護', shopName: '見本アクセサリー', itemPrice: 1280, mediumImageUrls: [{ imageUrl: img('Case', '334155') }], itemUrl: 'https://item.rakuten.co.jp/demo-shop-c/3/', postageFlag: 0 },
];

const yahooItems = [
  { id: 'demo-y1', title: 'ワイヤレスイヤホン ノイズキャンセリング 新品 国内正規品', shopName: 'サンプルストアY', price: 11800, currency: 'JPY', imageUrl: img('Earbuds Y1', '6d28d9'), url: 'https://store.shopping.yahoo.co.jp/demo-y/1.html', shippingText: '送料無料', conditionText: '新品' },
  { id: 'demo-y2', title: 'ワイヤレスイヤホン 未使用品 箱あり', shopName: 'デモリユース', price: 9980, currency: 'JPY', imageUrl: img('Earbuds Y2', '7c3aed'), url: 'https://store.shopping.yahoo.co.jp/demo-y/2.html', shippingText: '送料別', conditionText: '中古' },
];

const ebayItems = [
  { id: 'demo-e1', title: 'Wireless Earbuds Noise Cancelling Bluetooth (Japan ver.)', shopName: 'demo_seller', price: 89.99, currency: 'USD', imageUrl: img('eBay 1', '0f766e'), url: 'https://www.ebay.com/itm/000000000101', shippingText: '送料無料（米国内）', conditionText: 'New' },
  { id: 'demo-e2', title: 'Wireless Earbuds ANC Used Good Condition', shopName: 'sample_store', price: 64.5, currency: 'USD', imageUrl: img('eBay 2', '115e59'), url: 'https://www.ebay.com/itm/000000000102', conditionText: 'Used' },
];

const ok = (items: unknown[]) => ({ items, source: 'official_api', status: 'ok', requestId: 'manual' });

function svg(label: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#${color}"/><text x="150" y="108" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle">${label}</text></svg>`;
}

/** ページ内の /api/* と画像を差し替える。ebayNoKey=true で eBay を「設定前」にする。 */
export async function useManualFixtures(page: Page, { ebayNoKey = false } = {}) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/rakuten**', (route) => json(route, ok(rakutenItems)));
  await page.route('**/api/yahoo**', (route) => json(route, ok(yahooItems)));
  await page.route('**/api/ebay**', (route) =>
    ebayNoKey
      ? json(route, { items: [], source: 'official_api', status: 'error', error: 'no_key', requestId: 'manual' }, 503)
      : json(route, ok(ebayItems)),
  );
  await page.route('https://placehold.co/**', (route) => {
    const url = new URL(route.request().url());
    const [, , color = '334155'] = url.pathname.split('/');
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(url.searchParams.get('text') ?? '', color) });
  });
  // 外部サイト（まとめて開く）へは通信しない
  await page.context().route(/^https:\/\/(jp\.mercari\.com|auctions\.yahoo\.co\.jp|fril\.jp|www\.amazon\.co\.jp)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>demo</title>' }),
  );
}

export { QUERY_LABEL };
