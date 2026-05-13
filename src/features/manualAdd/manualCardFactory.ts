import type { MarketCard } from '../../types/market';
import { detectSiteNameFromUrl } from './siteDetector';

let counter = 0;

function parsePriceValue(priceText: string): number | undefined {
  const normalized = priceText.replace(/[，,]/g, '').trim();
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

export function createManualCard(params: {
  siteName: string;
  pageUrl: string;
  priceText: string;
  shippingText?: string;
  conditionText?: string;
  imageUrl?: string;
  note?: string;
}): MarketCard {
  const id = `manual-${Date.now()}-${++counter}`;
  const detectedSite = params.siteName.trim() || detectSiteNameFromUrl(params.pageUrl);
  const numericPrice = parsePriceValue(params.priceText);

  return {
    id,
    title: detectedSite ? `${detectedSite} の出品` : '手動追加カード',
    siteName: detectedSite || '不明',
    sourceType: 'manual',
    priceText: params.priceText,
    priceValue: numericPrice,
    currency: 'JPY',
    imageUrl: params.imageUrl || undefined,
    pageUrl: params.pageUrl,
    shippingText: params.shippingText || undefined,
    conditionText: params.conditionText || undefined,
    confidence: 'high',
    note: params.note || '手動追加',
    createdAt: new Date().toISOString(),
  };
}
