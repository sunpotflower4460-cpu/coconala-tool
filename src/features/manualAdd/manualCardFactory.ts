import type { MarketCard } from '../../types/market';
import { detectSiteNameFromUrl } from './siteDetector';

let counter = 0;

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
  const numericPrice = parseFloat(params.priceText.replace(/[^0-9.]/g, ''));

  return {
    id,
    title: detectedSite ? `${detectedSite} の出品` : '手動追加カード',
    siteName: detectedSite || '不明',
    sourceType: 'manual',
    priceText: params.priceText,
    priceValue: isNaN(numericPrice) ? undefined : numericPrice,
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
