import type { MarketCard, OfficialMarketId } from '../../types/market';
import { MARKET_LABELS } from '../../types/market';
import { checkSearchQuery } from '../../lib/searchQuery';
import { toSafeHttpsUrl } from '../../lib/safeUrl';
import { IS_STATIC_BUILD } from '../../lib/deployMode';
import { MAX_AMOUNT } from '../../features/profit/profitCalculator';
import { fetchOfficial } from './officialFetch';
import type { RakutenOutcome } from './rakutenAdapter';

/** `functions/api/market.ts` の NormalizedMarketItem と同じ形。 */
export type OfficialMarketItem = {
  id: string;
  title: string;
  shopName: string;
  price: number;
  currency: string;
  imageUrl?: string;
  url: string;
  shippingText?: string;
  conditionText?: string;
};

const API_PATH: Record<Exclude<OfficialMarketId, 'rakuten'>, string> = {
  yahoo_shopping: '/api/yahoo',
  ebay: '/api/ebay',
};

function formatPrice(price: number, currency: string): string {
  if (currency === 'JPY') return `¥${Math.round(price).toLocaleString('ja-JP')}`;
  if (currency === 'USD') return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${currency} ${price.toLocaleString('en-US')}`;
}

/** Yahoo!ショッピング・eBay の正規化済み商品をカードにする。壊れた商品は null。 */
export function mapOfficialItemToCard(market: Exclude<OfficialMarketId, 'rakuten'>, item: OfficialMarketItem): MarketCard | null {
  try {
    if (!item || typeof item !== 'object') return null;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const pageUrl = toSafeHttpsUrl(item.url);
    const price = typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 && item.price <= MAX_AMOUNT ? item.price : undefined;
    if (!title || !id || !pageUrl || price === undefined) return null;
    const currency = item.currency === 'JPY' || item.currency === 'USD' || item.currency === 'EUR' ? item.currency : 'OTHER';
    const shop = typeof item.shopName === 'string' ? item.shopName : '';
    return {
      id: `${market}-${id}`.slice(0, 200),
      title: title.slice(0, 100),
      siteName: (market === 'ebay' ? `eBay${shop ? `（${shop}）` : ''}` : `${shop ? `${shop}（Yahoo!ショッピング）` : 'Yahoo!ショッピング'}`).slice(0, 120),
      sourceType: 'official_api',
      priceText: formatPrice(price, typeof item.currency === 'string' ? item.currency : ''),
      priceValue: price,
      currency,
      imageUrl: toSafeHttpsUrl(item.imageUrl),
      pageUrl,
      shippingText: typeof item.shippingText === 'string' ? item.shippingText : undefined,
      conditionText: typeof item.conditionText === 'string' ? item.conditionText : undefined,
      confidence: 'high',
      note: `${MARKET_LABELS[market]} 公式API取得`,
      createdAt: new Date().toISOString(),
      market,
    };
  } catch {
    return null;
  }
}

/** Yahoo!ショッピング / eBay を検索する（見本データへの切り替えは呼び出し側）。 */
export async function fetchOfficialMarketOutcome(
  market: Exclude<OfficialMarketId, 'rakuten'>,
  query: string,
  limit: number,
): Promise<RakutenOutcome> {
  const check = checkSearchQuery(query);
  if (!check.ok) return check.issue === 'empty' ? { kind: 'empty' } : { kind: 'invalid_query' };
  if (IS_STATIC_BUILD) return { kind: 'fail', status: 'mock_no_key' };
  const raw = await fetchOfficial<OfficialMarketItem>(API_PATH[market], check.value, limit);
  if (raw.kind !== 'ok') return raw;
  const cards = raw.items.map((item) => mapOfficialItemToCard(market, item)).filter((c): c is MarketCard => Boolean(c));
  if (!cards.length) return { kind: 'fail', status: 'mock_upstream_error' };
  return { kind: 'ok', cards };
}
