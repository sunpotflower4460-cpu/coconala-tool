import type { MarketCard } from '../../types/market';

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
  if (typeof card.priceValue !== 'number' || Number.isNaN(card.priceValue)) return undefined;
  if (card.currency === 'USD') return Math.round(card.priceValue * exchangeRate);
  return Math.round(card.priceValue);
}
