import type { MarketCard } from '../../types/market';
import { detectSiteNameFromUrl } from './siteDetector';
import { clampAmount } from '../profit/profitCalculator';

let counter = 0;

/** 先頭の数値らしき部分（カンマ区切り可）だけを抽出する。負号は拾わない＝負の価格は生成されない。 */
function parsePriceValue(priceText: string): number | undefined {
  const normalized = priceText.replace(/[，,]/g, '').trim();
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? clampAmount(value) : undefined;
}

export function createManualCard(params: {
  title?: string;
  siteName: string;
  pageUrl: string;
  priceText: string;
  currency?: 'JPY' | 'USD';
  shippingText?: string;
  conditionText?: string;
  imageUrl?: string;
  note?: string;
}): MarketCard {
  const id = `manual-${Date.now()}-${++counter}`;
  const detectedSite = params.siteName.trim() || detectSiteNameFromUrl(params.pageUrl);
  const numericPrice = parsePriceValue(params.priceText);
  const title = params.title?.trim() || (detectedSite ? `${detectedSite} の出品` : '手動追加カード');

  return {
    id,
    title,
    siteName: detectedSite || '不明',
    sourceType: 'manual',
    priceText: params.priceText,
    priceValue: numericPrice,
    currency: params.currency ?? 'JPY',
    imageUrl: params.imageUrl || undefined,
    pageUrl: params.pageUrl,
    shippingText: params.shippingText || undefined,
    conditionText: params.conditionText || undefined,
    confidence: 'high',
    note: params.note || '手動追加',
    createdAt: new Date().toISOString(),
  };
}
