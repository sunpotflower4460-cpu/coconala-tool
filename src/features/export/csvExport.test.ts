import { describe, it, expect } from 'vitest';
import { buildResearchCsv, buildCsvFileContent } from './csvExport';
import type { MarketCard, ProfitSettings } from '../../types/market';

const profitSettings: ProfitSettings = {
  buyPrice: 6000,
  sellPrice: 10000,
  shippingCost: 500,
  feeRate: 10,
  exchangeRate: 155,
};

function makeCard(overrides: Partial<MarketCard>): MarketCard {
  return {
    id: 'c1',
    title: 'Sample',
    siteName: 'eBay',
    sourceType: 'official_api',
    priceText: '¥10,000',
    priceValue: 10000,
    currency: 'JPY',
    pageUrl: 'https://example.com/item',
    confidence: 'high',
    createdAt: '2026-06-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildResearchCsv', () => {
  it('writes the card header row first', () => {
    const csv = buildResearchCsv([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe(
      'title,siteName,sourceType,priceText,priceValue,currency,shippingText,conditionText,confidence,pageUrl,note,createdAt',
    );
  });

  it('escapes commas, quotes and newlines in product names', () => {
    const card = makeCard({ title: 'Sony "A55", black\nmint' });
    const csv = buildResearchCsv([card], profitSettings, '2026-06-24T00:00:00.000Z');
    // A quote becomes doubled, and the whole field is wrapped in quotes.
    expect(csv).toContain('"Sony ""A55"", black\nmint"');
  });

  it('still emits header and summary rows for an empty card list', () => {
    const csv = buildResearchCsv([], profitSettings, '2026-06-24T00:00:00.000Z');
    const lines = csv.split('\n');
    expect(lines[0]).toContain('title,siteName');
    // no card data rows, but the summary block is present
    expect(csv).toContain('summaryKey,summaryValue');
    expect(csv).toContain('estimatedProfit,2500');
  });

  it('includes the computed estimated profit in the summary', () => {
    const csv = buildResearchCsv([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    // sell 10000 - fee 1000 - buy 6000 - shipping 500 = 2500
    expect(csv).toContain('estimatedProfit,2500');
  });
});

describe('buildCsvFileContent', () => {
  it('prefixes a UTF-8 BOM for Excel compatibility', () => {
    const content = buildCsvFileContent([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(content.startsWith('﻿')).toBe(true);
    // the BOM is the only thing before the header
    expect(content.slice(1).split('\n')[0]).toContain('title,siteName');
  });
});
