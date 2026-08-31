import { describe, it, expect } from 'vitest';
import {
  sanitizeCards,
  sanitizeHistoryPersisted,
  sanitizeMarketCard,
  sanitizeProfitSettings,
  sanitizeResearchPersisted,
  defaultProfitSettings,
} from './persistSanitize';

describe('sanitizeProfitSettings', () => {
  it('NaN/Infinity/負数/欠落を安全な既定値へ正規化する', () => {
    expect(
      sanitizeProfitSettings({
        buyPrice: Number.NaN,
        sellPrice: Number.POSITIVE_INFINITY,
        shippingCost: -10,
        feeRate: 250,
        exchangeRate: Number.NEGATIVE_INFINITY,
      }),
    ).toEqual({
      buyPrice: 0,
      sellPrice: 0,
      shippingCost: 0,
      feeRate: 100,
      exchangeRate: 0,
    });
  });

  it('null や配列は既定値へフォールバックする', () => {
    expect(sanitizeProfitSettings(null)).toEqual(defaultProfitSettings);
    expect(sanitizeProfitSettings([])).toEqual(defaultProfitSettings);
  });
});

describe('sanitizeMarketCard', () => {
  it('javascript: の pageUrl / imageUrl を除去する', () => {
    const card = sanitizeMarketCard({
      id: 'c1',
      title: 'xss',
      siteName: 'evil',
      sourceType: 'manual',
      pageUrl: 'javascript:alert(1)',
      imageUrl: 'javascript:alert(1)',
      confidence: 'high',
      createdAt: '2026-08-31T00:00:00.000Z',
    });
    expect(card?.pageUrl).toBe('');
    expect(card?.imageUrl).toBeUndefined();
  });

  it('id が無い壊れたカードは捨てる', () => {
    expect(sanitizeMarketCard({ title: 'no-id', pageUrl: 'https://example.com' })).toBeUndefined();
  });

  it('未知の sourceType は manual へ落とす', () => {
    const card = sanitizeMarketCard({
      id: 'c1',
      title: 'x',
      siteName: 's',
      sourceType: 'scraped',
      pageUrl: 'https://example.com/item',
      confidence: 'nope',
      createdAt: '2026-08-31T00:00:00.000Z',
    });
    expect(card?.sourceType).toBe('manual');
    expect(card?.confidence).toBe('low');
  });
});

describe('sanitizeResearchPersisted', () => {
  it('未知の theme / dataSourceMode は採用しない', () => {
    expect(sanitizeResearchPersisted({ theme: 'neon-hacker', dataSourceMode: 'live_scrape' })).toEqual({});
  });

  it('部分的に壊れた利益設定だけを正規化して残す', () => {
    const result = sanitizeResearchPersisted({
      theme: 'dark-trader',
      profitSettings: { buyPrice: -5, feeRate: 10 },
    });
    expect(result.theme).toBe('dark-trader');
    expect(result.profitSettings?.buyPrice).toBe(0);
    expect(result.profitSettings?.feeRate).toBe(10);
  });
});

describe('sanitizeHistoryPersisted', () => {
  it('sessions が配列でない場合は空にする', () => {
    expect(sanitizeHistoryPersisted({ sessions: 'broken' })).toEqual({ sessions: [] });
    expect(sanitizeHistoryPersisted(null)).toEqual({ sessions: [] });
  });

  it('壊れたセッションを捨て、javascript URL を除去する', () => {
    const result = sanitizeHistoryPersisted({
      sessions: [
        { name: 'no-id' },
        {
          id: 'ok',
          name: 'safe',
          query: 'PS5',
          resultCards: [
            {
              id: 'c1',
              title: 'item',
              siteName: 'x',
              sourceType: 'manual',
              pageUrl: 'javascript:alert(1)',
              confidence: 'high',
              createdAt: '2026-08-31T00:00:00.000Z',
            },
          ],
          comparedCards: 'nope',
          profitSettings: { feeRate: 999 },
        },
      ],
    });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].resultCards[0].pageUrl).toBe('');
    expect(result.sessions[0].comparedCards).toEqual([]);
    expect(result.sessions[0].profitSettings.feeRate).toBe(100);
  });
});

describe('sanitizeCards', () => {
  it('配列以外は空配列', () => {
    expect(sanitizeCards(undefined)).toEqual([]);
    expect(sanitizeCards({ id: 'x' })).toEqual([]);
  });
});
