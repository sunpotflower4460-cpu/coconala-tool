import { describe, it, expect } from 'vitest';
import { buildResearchCsv, buildCsvFileContent } from './csvExport';
import type { MarketCard, ProfitSettings } from '../../types/market';
import type { CsvSearchMeta } from './csvExport';

const profitSettings: ProfitSettings = {
  buyPrice: 6000,
  sellPrice: 10000,
  shippingCost: 500,
  feeRate: 10,
  exchangeRate: 155,
};

const searchMeta: CsvSearchMeta = {
  dataSourceMode: 'rakuten_mock',
  searchStatus: 'mock_no_key',
  searchWarnings: ['楽天APIキーが未設定のため、公式API想定モックを表示しています。'],
  lastSearchedAt: '2026-07-22T00:00:00.000Z',
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
  it('writes the Japanese card header row first', () => {
    const csv = buildResearchCsv([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe(
      '商品名,サイト名,データ種別,ソース区分,価格表示,価格,通貨,送料,状態,信頼度,元URL,メモ,取得日時',
    );
  });

  it('labels a real (non-demo) card as 実データ, and a sample/mock card accordingly', () => {
    const realCsv = buildResearchCsv([makeCard({ demoOrigin: undefined })], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(realCsv.split('\n')[1]).toContain('実データ');

    const sampleCsv = buildResearchCsv([makeCard({ demoOrigin: 'sample' })], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(sampleCsv.split('\n')[1]).toContain('サンプルデータ');

    const mockCsv = buildResearchCsv([makeCard({ demoOrigin: 'mock' })], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(mockCsv.split('\n')[1]).toContain('モック（楽天API想定）');
  });

  it('translates sourceType into the Japanese ソース区分 label', () => {
    const csv = buildResearchCsv([makeCard({ sourceType: 'manual' })], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(csv.split('\n')[1]).toContain('手動追加');
  });

  it('escapes commas, quotes and newlines in product names', () => {
    const card = makeCard({ title: 'Sony "A55", black\nmint' });
    const csv = buildResearchCsv([card], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(csv).toContain('"Sony ""A55"", black\nmint"');
  });

  it('neutralizes formula-injection payloads (=, +, -, @) in cell values', () => {
    const titles = ['=SUM(A1:A9)', '+1+1', '-1+1', '@SUM(1+1)', 'ダミー商品名'];
    for (const title of titles) {
      const card = makeCard({ title });
      const csv = buildResearchCsv([card], profitSettings, '2026-06-24T00:00:00.000Z');
      const dataLine = csv.split('\n')[1];
      const isDangerous = /^[=+\-@]/.test(title);
      if (isDangerous) {
        // the raw dangerous prefix must never appear unescaped at the start of the field
        expect(dataLine.startsWith(title)).toBe(false);
        // a leading text-marker quote neutralizes it for spreadsheet apps
        expect(dataLine).toContain(`'${title}`);
      } else {
        expect(dataLine).toContain(title);
      }
    }
  });

  it('does not alter a benign title that happens to contain these characters mid-string', () => {
    const card = makeCard({ title: 'PS5 CFI-2000A01 (新品)' });
    const csv = buildResearchCsv([card], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(csv.split('\n')[1]).toContain('PS5 CFI-2000A01 (新品)');
  });

  it('still emits header and summary rows for an empty card list', () => {
    const csv = buildResearchCsv([], profitSettings, '2026-06-24T00:00:00.000Z');
    const lines = csv.split('\n');
    expect(lines[0]).toContain('商品名,サイト名');
    expect(csv).toContain('項目,値');
    expect(csv).toContain('利益見込み,2500');
  });

  it('includes the computed estimated profit in the summary', () => {
    const csv = buildResearchCsv([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    // sell 10000 - fee 1000 - buy 6000 - shipping 500 = 2500
    expect(csv).toContain('利益見込み,2500');
  });

  it('handles 0円 profit settings without error', () => {
    const zero: ProfitSettings = { buyPrice: 0, sellPrice: 0, shippingCost: 0, feeRate: 0, exchangeRate: 155 };
    const csv = buildResearchCsv([makeCard({})], zero, '2026-06-24T00:00:00.000Z');
    expect(csv).toContain('利益見込み,0');
  });

  it('includes search metadata (data source / status / warnings / searched-at) when provided', () => {
    const csv = buildResearchCsv([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z', searchMeta);
    expect(csv).toContain('データソース,楽天市場');
    expect(csv).toContain('モック（キー未設定）');
    expect(csv).toContain('検索日時,2026-07-22T00:00:00.000Z');
    expect(csv).toContain('楽天APIキーが未設定のため');
  });

  it('leaves search metadata columns blank when not provided', () => {
    const csv = buildResearchCsv([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(csv).toContain('データソース,\n');
  });
});

describe('buildCsvFileContent', () => {
  it('prefixes a UTF-8 BOM for Excel compatibility', () => {
    const content = buildCsvFileContent([makeCard({})], profitSettings, '2026-06-24T00:00:00.000Z');
    expect(content.startsWith('﻿')).toBe(true);
    expect(content.slice(1).split('\n')[0]).toContain('商品名,サイト名');
  });
});
