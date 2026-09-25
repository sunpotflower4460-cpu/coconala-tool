import type { MarketCard } from '../types/market';
import { toJpyPrice } from '../features/profit/profitCalculator';

/** 外れ値の判定: 全カードの中央値に対して、これより安い／高いものは別商品（付属品・まとめ売り等）の可能性が高い。 */
export const LOW_RATIO = 0.35;
export const HIGH_RATIO = 3;
/** 件数が少ないと中央値があてにならないため、この件数未満では判定しない。 */
export const MIN_PRICES_FOR_OUTLIERS = 4;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type OutlierReason = 'too_low' | 'too_high';

/**
 * 相場から大きく外れたカード（中央値の35%未満・3倍超）を返す。
 * 例:「Nintendo Switch 2」で ¥8,080 のケースが本体（約¥59,000）に混ざるのを見分ける。
 * 手入力の価格は利用者が確かめた値なので対象にしない。
 */
export function findPriceOutliers(cards: MarketCard[], exchangeRate: number): Map<string, OutlierReason> {
  const priced = cards
    .filter((card) => card.sourceType !== 'manual')
    .map((card) => ({ id: card.id, price: toJpyPrice(card, exchangeRate) }))
    .filter((entry): entry is { id: string; price: number } => typeof entry.price === 'number' && entry.price > 0);
  const result = new Map<string, OutlierReason>();
  if (priced.length < MIN_PRICES_FOR_OUTLIERS) return result;
  const mid = median(priced.map((p) => p.price));
  for (const { id, price } of priced) {
    if (price < mid * LOW_RATIO) result.set(id, 'too_low');
    else if (price > mid * HIGH_RATIO) result.set(id, 'too_high');
  }
  return result;
}
