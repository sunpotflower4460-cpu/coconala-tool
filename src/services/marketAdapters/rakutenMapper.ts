import type { MarketCard } from '../../types/market';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';

export function mapRakutenItemToMarketCard(item: RakutenMockItem): MarketCard {
  return {
    id: `rakuten-${item.itemCode}`,
    title: item.itemName.slice(0, 100),
    siteName: `${item.shopName}（楽天市場）`,
    sourceType: 'official_api',
    priceText: `¥${item.itemPrice.toLocaleString('ja-JP')}`,
    priceValue: Number(item.itemPrice),
    currency: 'JPY',
    imageUrl: item.mediumImageUrls[0]?.imageUrl,
    pageUrl: item.itemUrl,
    shippingText: item.postageFlag === 0 ? '送料無料' : '送料別途',
    conditionText: '新品',
    confidence: 'high',
    note: '楽天市場 公式API取得（モック）',
    createdAt: new Date().toISOString(),
  };
}
