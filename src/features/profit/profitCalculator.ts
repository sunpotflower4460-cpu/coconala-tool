import type { MarketCard } from '../../types/market';

/** 価格・送料・為替レート等の金額入力の上限（異常値・Infinity対策）。 */
export const MAX_AMOUNT = 100_000_000;

/** 0以上・MAX_AMOUNT以下にクランプする。NaN/Infinity/負数は0扱いにする。 */
export function clampAmount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, MAX_AMOUNT);
}

/** 手数料率を0〜100%にクランプする。NaN/Infinity/負数は0扱いにする。 */
export function clampFeeRate(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 100);
}

export function calcFee(sellPrice: number, feeRate: number): number {
  return sellPrice * (feeRate / 100);
}

export function calcProfit(
  sellPrice: number,
  buyPrice: number,
  shippingCost: number,
  feeRate: number,
): number {
  return sellPrice - calcFee(sellPrice, feeRate) - buyPrice - shippingCost;
}

export function calcMargin(profit: number, sellPrice: number): number {
  return sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
}

export function profitBadge(profit: number, margin: number) {
  if (profit > 0 && margin >= 15) return { label: '狙い目', color: 'bg-emerald-500/80 text-white' };
  if (profit > 0) return { label: '要確認', color: 'bg-yellow-500/80 text-black' };
  return { label: '利益薄い', color: 'bg-red-500/80 text-white' };
}

export function toJpyPrice(card: MarketCard, exchangeRate: number): number | undefined {
  if (typeof card.priceValue !== 'number' || !Number.isFinite(card.priceValue)) return undefined;
  if (card.currency === 'USD') {
    // レート未入力・0 は「0円」にせず換算不能として扱う。$100 × 0 = ¥0 の誤適用を防ぐ。
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return undefined;
    const converted = card.priceValue * exchangeRate;
    return Number.isFinite(converted) ? Math.round(converted) : undefined;
  }
  return Math.round(card.priceValue);
}
