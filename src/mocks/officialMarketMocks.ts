import type { OfficialMarketItem } from '../services/marketAdapters/officialMarketAdapter';
import { matchesAllKeywords } from '../lib/keywordMatch';

/** Yahoo!ショッピング・eBay の見本データ（実在しない商品）。どの公式APIにも接続できないときだけ使う。 */
const yahooItems: OfficialMarketItem[] = [
  { id: 'mock-yahoo-ps5', title: 'PlayStation 5 本体 CFI-2000A01 新品', shopName: '見本ストアY', price: 77980, currency: 'JPY', imageUrl: 'https://placehold.co/300x200/7c3aed/ffffff?text=Yahoo+PS5', url: 'https://store.shopping.yahoo.co.jp/mock-store/ps5.html', shippingText: '送料無料', conditionText: '新品' },
  { id: 'mock-yahoo-walkman', title: 'SONY ウォークマン NW-A306 ブラック', shopName: '見本オーディオY', price: 36800, currency: 'JPY', imageUrl: 'https://placehold.co/300x200/6d28d9/ffffff?text=Yahoo+Walkman', url: 'https://store.shopping.yahoo.co.jp/mock-audio/nw-a306.html', shippingText: '送料無料', conditionText: '新品' },
  { id: 'mock-yahoo-3ds', title: 'Nintendo 3DS LL 本体 中古', shopName: '見本ゲームY', price: 15800, currency: 'JPY', imageUrl: 'https://placehold.co/300x200/5b21b6/ffffff?text=Yahoo+3DS', url: 'https://store.shopping.yahoo.co.jp/mock-game/3dsll.html', conditionText: '中古' },
];

const ebayItems: OfficialMarketItem[] = [
  { id: 'mock-ebay-ps5', title: 'Sony PlayStation 5 Slim Console (PS5)', shopName: 'mock_seller', price: 449.99, currency: 'USD', imageUrl: 'https://placehold.co/300x200/0f766e/ffffff?text=eBay+PS5', url: 'https://www.ebay.com/itm/000000000001', shippingText: '送料無料（米国内）', conditionText: 'Used' },
  { id: 'mock-ebay-walkman', title: 'Sony Walkman NW-A306 32GB Black ウォークマン', shopName: 'mock_audio', price: 239.0, currency: 'USD', imageUrl: 'https://placehold.co/300x200/115e59/ffffff?text=eBay+Walkman', url: 'https://www.ebay.com/itm/000000000002', conditionText: 'New' },
  { id: 'mock-ebay-3ds', title: 'Nintendo 3DS LL XL Console White', shopName: 'mock_games', price: 109.5, currency: 'USD', imageUrl: 'https://placehold.co/300x200/134e4a/ffffff?text=eBay+3DS', url: 'https://www.ebay.com/itm/000000000003', conditionText: 'Pre-owned' },
];

export function searchOfficialMarketMock(market: 'yahoo_shopping' | 'ebay', keyword: string, limit = 8): OfficialMarketItem[] {
  const items = market === 'ebay' ? ebayItems : yahooItems;
  return items.filter((item) => matchesAllKeywords(keyword, [item.title, item.shopName])).slice(0, limit);
}
