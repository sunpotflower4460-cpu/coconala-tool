import { calcProfit } from '../profit/profitCalculator';
import type { MarketCard, ProfitSettings } from '../../types/market';

const cardHeader = [
  'title',
  'siteName',
  'sourceType',
  'priceText',
  'priceValue',
  'currency',
  'shippingText',
  'conditionText',
  'confidence',
  'pageUrl',
  'note',
  'createdAt',
];

function escapeCsvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  const normalized = String(value).replace(/"/g, '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

export function buildResearchCsv(
  cards: MarketCard[],
  profitSettings: ProfitSettings,
  generatedAt: string,
): string {
  const cardRows = cards.map((card) =>
    [
      card.title,
      card.siteName,
      card.sourceType,
      card.priceText,
      card.priceValue,
      card.currency,
      card.shippingText,
      card.conditionText,
      card.confidence,
      card.pageUrl,
      card.note,
      card.createdAt,
    ]
      .map((value) => escapeCsvCell(value))
      .join(','),
  );

  const estimatedProfit = calcProfit(
    profitSettings.sellPrice,
    profitSettings.buyPrice,
    profitSettings.shippingCost,
    profitSettings.feeRate,
  );

  const summaryRows = [
    ['summaryKey', 'summaryValue'],
    ['generatedAt', generatedAt],
    ['buyPrice', profitSettings.buyPrice],
    ['sellPrice', profitSettings.sellPrice],
    ['shippingCost', profitSettings.shippingCost],
    ['feeRate', profitSettings.feeRate],
    ['exchangeRate', profitSettings.exchangeRate],
    ['estimatedProfit', estimatedProfit],
  ].map((row) => row.map((value) => escapeCsvCell(value)).join(','));

  return [cardHeader.join(','), ...cardRows, '', ...summaryRows].join('\n');
}

/**
 * \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u7528\u306E\u30D5\u30A1\u30A4\u30EB\u5185\u5BB9\uFF08Excel \u306E\u6587\u5B57\u5316\u3051\u5BFE\u7B56\u306B UTF-8 BOM \u3092\u5148\u982D\u4ED8\u4E0E\uFF09\u3002
 */
export function buildCsvFileContent(
  cards: MarketCard[],
  profitSettings: ProfitSettings,
  generatedAt: string,
): string {
  return `\uFEFF${buildResearchCsv(cards, profitSettings, generatedAt)}`;
}

export function downloadResearchCsv(cards: MarketCard[], profitSettings: ProfitSettings): void {
  const generatedAt = new Date().toISOString();
  const csv = buildCsvFileContent(cards, profitSettings, generatedAt);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `research-session-${generatedAt.replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
