import type { MarketCard } from '../../types/market';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';
import { MAX_AMOUNT } from '../../features/profit/profitCalculator';
import { toSafeHttpsUrl } from '../../lib/safeUrl';

const MAX_RAKUTEN_TITLE_LENGTH = 100;

/**
 * 楽天商品価格として採用してよい値か。
 * 不正値を 0 へ変換しない。正当な 0 円だけを 0 として残す。
 */
export function parseRakutenItemPrice(value: unknown): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return undefined;
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AMOUNT) return undefined;
    return parsed;
  }
  return undefined;
}

/**
 * 楽天商品をカード化する。必須識別子・商品名・https商品URLが欠けた壊れた商品は null。
 * マッピング中に例外を出さない（1件の壊れた商品で検索全体を落とさない）。
 */
export function mapRakutenItemToMarketCard(item: RakutenMockItem): MarketCard | null {
  try {
    if (!item || typeof item !== 'object') return null;
    const itemCode = typeof item.itemCode === 'string' ? item.itemCode.trim() : '';
    const itemName = typeof item.itemName === 'string' ? item.itemName.trim() : '';
    if (!itemCode || !itemName) return null;

    const pageUrl = toSafeHttpsUrl(item.itemUrl);
    if (!pageUrl) return null;

    const priceValue = parseRakutenItemPrice(item.itemPrice);
    if (priceValue === undefined) return null;
    const shopName = typeof item.shopName === 'string' ? item.shopName : '';
    const imageUrl = toSafeHttpsUrl(item.mediumImageUrls?.[0]?.imageUrl);

    return {
      id: `rakuten-${itemCode}`.slice(0, 200),
      title: itemName.slice(0, MAX_RAKUTEN_TITLE_LENGTH),
      siteName: `${shopName}（楽天市場）`.slice(0, 120),
      sourceType: 'official_api',
      priceText: `¥${priceValue.toLocaleString('ja-JP')}`,
      priceValue,
      currency: 'JPY',
      imageUrl,
      pageUrl,
      shippingText: Number(item.postageFlag) === 0 ? '送料無料' : '送料別途',
      conditionText: '新品',
      confidence: 'high',
      note: '楽天市場 公式API取得',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
