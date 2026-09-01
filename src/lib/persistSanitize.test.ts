import { describe, it, expect } from 'vitest';
import {
  sanitizeCards,
  sanitizeHistoryPersisted,
  sanitizeLastSearchedAt,
  sanitizeMarketCard,
  sanitizeProfitSettings,
  sanitizeResearchPersisted,
  sanitizeSavedSession,
  sanitizeSearchStatus,
  sanitizeSearchWarnings,
  sanitizeThemeId,
  migrateHistoryPersisted,
  defaultProfitSettings,
} from './persistSanitize';
import { MAX_SEARCH_WARNING_LENGTH, MAX_SEARCH_WARNINGS } from './limits';

const profitSettings = {
  buyPrice: 8000,
  sellPrice: 12000,
  shippingCost: 500,
  feeRate: 10,
  exchangeRate: 155,
};

const validCard = {
  id: 'c1',
  title: 'PS5 本体',
  siteName: '楽天市場',
  sourceType: 'official_api' as const,
  pageUrl: 'https://item.rakuten.co.jp/shop/ps5/',
  priceValue: 79800,
  priceText: '¥79,800',
  confidence: 'high' as const,
  createdAt: '2026-07-22T00:00:00.000Z',
};

function validSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-ok',
    name: 'PS5相場',
    query: 'PS5',
    resultCards: [validCard],
    comparedCards: [validCard],
    profitSettings,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T01:00:00.000Z',
    dataSourceMode: 'rakuten_mock',
    searchStatus: 'official_api',
    searchWarnings: ['楽天市場 公式API取得。価格・在庫は変動します。'],
    lastSearchedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

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

  it('version 0 相当の正常履歴を現行 schema へ変換し、検索メタデータを保持する', () => {
    const migrated = migrateHistoryPersisted({ sessions: [validSession()] }, 0);
    expect(migrated.sessions).toHaveLength(1);
    const session = migrated.sessions[0];
    expect(session.name).toBe('PS5相場');
    expect(session.query).toBe('PS5');
    expect(session.resultCards).toHaveLength(1);
    expect(session.resultCards[0].title).toBe('PS5 本体');
    expect(session.comparedCards).toHaveLength(1);
    expect(session.profitSettings).toEqual(profitSettings);
    expect(session.dataSourceMode).toBe('rakuten_mock');
    expect(session.searchStatus).toBe('official_api');
    expect(session.searchWarnings).toEqual(['楽天市場 公式API取得。価格・在庫は変動します。']);
    expect(session.lastSearchedAt).toBe('2026-07-22T00:00:00.000Z');
    expect(session.createdAt).toBe('2026-07-22T00:00:00.000Z');
    expect(session.updatedAt).toBe('2026-07-22T01:00:00.000Z');
  });

  it('sessions 内の壊れた1件だけ除外し、正常セッションは残す', () => {
    const migrated = migrateHistoryPersisted(
      {
        sessions: [validSession({ id: 'ok-1', name: '正常' }), { name: 'idなし' }, validSession({ id: 'ok-2', name: '正常2' })],
      },
      0,
    );
    expect(migrated.sessions.map((session) => session.id)).toEqual(['ok-1', 'ok-2']);
  });

  it('完全に壊れた persisted state は空履歴へフォールバックする', () => {
    expect(migrateHistoryPersisted(null, 0)).toEqual({ sessions: [] });
    expect(migrateHistoryPersisted('broken', 0)).toEqual({ sessions: [] });
    expect(migrateHistoryPersisted({ sessions: 123 }, 0)).toEqual({ sessions: [] });
  });
});

describe('sanitizeSearchStatus / warnings / lastSearchedAt', () => {
  it('許可された MarketSearchStatus だけを残し、不正値は null（勝手に sample へしない）', () => {
    expect(sanitizeSearchStatus('official_api')).toBe('official_api');
    expect(sanitizeSearchStatus('mock_no_key')).toBe('mock_no_key');
    expect(sanitizeSearchStatus('mock_timeout')).toBe('mock_timeout');
    expect(sanitizeSearchStatus('live_scrape')).toBeNull();
    expect(sanitizeSearchStatus(0)).toBeNull();
    expect(sanitizeSearchStatus(null)).toBeNull();
  });

  it('searchWarnings は string[] のみ採用し、長さと件数を上限する', () => {
    expect(sanitizeSearchWarnings('not-array')).toEqual([]);
    expect(sanitizeSearchWarnings([1, 'ok', null])).toEqual(['ok']);
    expect(sanitizeSearchWarnings(['x'.repeat(MAX_SEARCH_WARNING_LENGTH + 10)])[0]).toHaveLength(
      MAX_SEARCH_WARNING_LENGTH,
    );
    expect(sanitizeSearchWarnings(Array.from({ length: MAX_SEARCH_WARNINGS + 5 }, (_, i) => `w${i}`))).toHaveLength(
      MAX_SEARCH_WARNINGS,
    );
  });

  it('lastSearchedAt は妥当な ISO 日時文字列だけ残す', () => {
    expect(sanitizeLastSearchedAt('2026-07-22T00:00:00.000Z')).toBe('2026-07-22T00:00:00.000Z');
    expect(sanitizeLastSearchedAt('not-a-date')).toBeNull();
    expect(sanitizeLastSearchedAt(123)).toBeNull();
    expect(sanitizeLastSearchedAt('2026-07-22')).toBeNull();
  });
});

describe('sanitizeSavedSession search metadata', () => {
  it('hydrate 後も official_api / mock_no_key / mock_timeout / warnings / lastSearchedAt を保持する', () => {
    for (const status of ['official_api', 'mock_no_key', 'mock_timeout'] as const) {
      const session = sanitizeSavedSession(validSession({ searchStatus: status }));
      expect(session?.searchStatus).toBe(status);
      expect(session?.searchWarnings).toEqual(['楽天市場 公式API取得。価格・在庫は変動します。']);
      expect(session?.lastSearchedAt).toBe('2026-07-22T00:00:00.000Z');
    }
  });

  it('不正なメタデータだけを捨て、セッション自体は残す', () => {
    const session = sanitizeSavedSession(
      validSession({
        searchStatus: 'not-a-status',
        searchWarnings: 'broken',
        lastSearchedAt: 'yesterday',
      }),
    );
    expect(session?.id).toBe('session-ok');
    expect(session?.name).toBe('PS5相場');
    expect(session?.searchStatus).toBeNull();
    expect(session?.searchWarnings).toEqual([]);
    expect(session?.lastSearchedAt).toBeNull();
  });
});

describe('sanitizeCards', () => {
  it('配列以外は空配列', () => {
    expect(sanitizeCards(undefined)).toEqual([]);
    expect(sanitizeCards({ id: 'x' })).toEqual([]);
  });
});

describe('prototype pollution / unknown keys', () => {
  it('JSON の __proto__ / constructor をテーマや利益に採用しない', () => {
    const polluted = JSON.parse('{"__proto__":{"theme":"hacked"},"constructor":{"prototype":{"theme":"hacked"}}}');
    expect(sanitizeResearchPersisted(polluted)).toEqual({});
    expect(sanitizeThemeId(({} as { theme?: string }).theme)).toBeUndefined();
  });

  it('未知フィールドを混入しても許可キー以外は残さない', () => {
    const result = sanitizeResearchPersisted({
      theme: 'dark-trader',
      isSearching: true,
      query: '<script>alert(1)</script>',
      extra: { nested: true },
    });
    expect(result).toEqual({ theme: 'dark-trader' });
    expect(result).not.toHaveProperty('isSearching');
    expect(result).not.toHaveProperty('query');
    expect(result).not.toHaveProperty('extra');
  });
});
