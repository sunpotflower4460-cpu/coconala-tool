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

/**
 * 価格表記から数値を読む。全角数字・カンマ・「1.5万円」「2万5000円」「3千円」に対応する。
 * 数値が複数あって意味が決められない表記（「12,800〜15,000円」「3点 12800円」）は読まずに undefined を返し、
 * 誤った価格で利益計算しないようにする。負号は拾わない＝負の価格は生成されない。
 */
export function parsePriceValue(priceText: string): number | undefined {
  const normalized = priceText.normalize('NFKC').replace(/,/g, '').replace(/\s+/g, '');
  const unitPattern = /^(\d+(?:\.\d+)?)万(?:(\d+)千|(\d+))?/;
  const numbers = normalized.match(/\d+(?:\.\d+)?/g) ?? [];
  if (numbers.length === 0) return undefined;

  const start = normalized.search(/\d/);
  const rest = normalized.slice(start);
  const man = rest.match(unitPattern);
  let value: number;
  let consumed: number;
  if (man) {
    value = Number(man[1]) * 10_000 + (man[2] ? Number(man[2]) * 1_000 : 0) + (man[3] ? Number(man[3]) : 0);
    consumed = man[0].length;
  } else {
    const sen = rest.match(/^(\d+(?:\.\d+)?)千/);
    if (sen) {
      value = Number(sen[1]) * 1_000;
      consumed = sen[0].length;
    } else {
      const plain = rest.match(/^\d+(?:\.\d+)?/)!;
      value = Number(plain[0]);
      consumed = plain[0].length;
    }
  }
  // 読み取った部分より後ろに別の数値があれば曖昧とみなす。
  if (/\d/.test(rest.slice(consumed))) return undefined;
  return Number.isFinite(value) ? clampAmount(Math.round(value * 100) / 100) : undefined;
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
