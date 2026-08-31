import type { MarketCard } from '../../types/market';
import { detectSiteNameFromUrl } from './siteDetector';
import { clampAmount } from '../profit/profitCalculator';
import { toSafeHttpUrl, toSafeHttpsUrl } from '../../lib/safeUrl';
import {
  MAX_CARD_CONDITION_TEXT_LENGTH,
  MAX_CARD_NOTE_LENGTH,
  MAX_CARD_PRICE_TEXT_LENGTH,
  MAX_CARD_SHIPPING_TEXT_LENGTH,
  MAX_CARD_SITE_NAME_LENGTH,
  MAX_CARD_TITLE_LENGTH,
} from '../../lib/limits';

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
  const pageUrl = toSafeHttpUrl(params.pageUrl) ?? '';
  const detectedSite = params.siteName.trim().slice(0, MAX_CARD_SITE_NAME_LENGTH) || detectSiteNameFromUrl(pageUrl);
  const numericPrice = parsePriceValue(params.priceText);
  const title =
    params.title?.trim().slice(0, MAX_CARD_TITLE_LENGTH) ||
    (detectedSite ? `${detectedSite} の出品` : '手動追加カード');

  return {
    id,
    title,
    siteName: detectedSite || '不明',
    sourceType: 'manual',
    priceText: params.priceText.slice(0, MAX_CARD_PRICE_TEXT_LENGTH),
    priceValue: numericPrice,
    currency: params.currency ?? 'JPY',
    imageUrl: toSafeHttpsUrl(params.imageUrl),
    pageUrl,
    shippingText: params.shippingText?.slice(0, MAX_CARD_SHIPPING_TEXT_LENGTH) || undefined,
    conditionText: params.conditionText?.slice(0, MAX_CARD_CONDITION_TEXT_LENGTH) || undefined,
    confidence: 'high',
    note: (params.note || '手動追加').slice(0, MAX_CARD_NOTE_LENGTH),
    createdAt: new Date().toISOString(),
  };
}
