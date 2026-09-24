import { describe, it, expect } from 'vitest';
import { buildRuleBasedInsights } from './ruleBasedInsight';
import type { MarketCard, ProfitSettings } from '../../types/market';

const settings = (overrides: Partial<ProfitSettings> = {}): ProfitSettings => ({
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 500,
  feeRate: 10,
  exchangeRate: 155,
  ...overrides,
});

const card = (overrides: Partial<MarketCard> = {}): MarketCard => ({
  id: Math.random().toString(36),
  title: 't',
  siteName: 's',
  sourceType: 'official_api',
  pageUrl: 'https://example.com/',
  confidence: 'high',
  createdAt: '',
  priceValue: 1000,
  currency: 'JPY',
  ...overrides,
});

const ids = (cards: MarketCard[], s: ProfitSettings) => buildRuleBasedInsights(cards, s).map((m) => m.id);

describe('buildRuleBasedInsights', () => {
  it('価格が未入力のうちは赤字・薄利の警告を出さない', () => {
    const result = ids([card()], settings());
    expect(result).not.toContain('loss');
    expect(result).not.toContain('thin-profit');
  });

  it('赤字なら loss、利益率10%未満なら thin-profit を出す', () => {
    expect(ids([card()], settings({ buyPrice: 12000, sellPrice: 10000 }))).toContain('loss');
    // 10000 - 1000(10%) - 8000 - 500 = 500 → 5%
    const thin = ids([card()], settings({ buyPrice: 8000, sellPrice: 10000 }));
    expect(thin).toContain('thin-profit');
    expect(thin).not.toContain('loss');
  });

  it('送料・手数料が0なら未反映の注意を出す', () => {
    expect(ids([card()], settings({ shippingCost: 0, sellPrice: 10000, buyPrice: 1000 }))).toContain('shipping-fee-check');
  });

  it('USDカード・推定カード中心・手動カード・価格差1.5倍以上をそれぞれ検知する', () => {
    const cards = [
      card({ currency: 'USD', priceValue: 100 }),
      card({ sourceType: 'search_api', priceValue: 1000 }),
      card({ sourceType: 'search_link', priceValue: 30000 }),
      card({ sourceType: 'manual', priceValue: 2000 }),
    ];
    const result = ids(cards, settings({ sellPrice: 50000, buyPrice: 1000 }));
    expect(result).toEqual(expect.arrayContaining(['usd-caution', 'estimated-source', 'manual-check', 'price-gap']));
  });

  it('注意点が無ければ stable を1件だけ返す', () => {
    expect(ids([card()], settings({ sellPrice: 20000, buyPrice: 5000 }))).toEqual(['stable']);
  });
});
