import type { MarketCard, MarketId } from '../types/market';
import { detectMarketFromUrl } from '../features/manualAdd/siteDetector';

/** カードの販売サイト。古い保存データ（market なし）は URL から判定する。 */
export function marketOf(card: MarketCard): MarketId {
  return card.market ?? detectMarketFromUrl(card.pageUrl);
}
