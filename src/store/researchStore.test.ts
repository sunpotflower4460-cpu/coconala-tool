import { describe, it, expect, beforeEach } from 'vitest';
import { useResearchStore } from './researchStore';

const defaultProfitSettings = {
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 0,
  feeRate: 10,
  exchangeRate: 155,
};

describe('researchStore profit settings validation', () => {
  beforeEach(() => {
    useResearchStore.setState({
      profitSettings: { ...defaultProfitSettings },
      buyPriceSource: null,
      sellPriceSource: null,
    });
  });

  it('clamps negative buyPrice to 0', () => {
    useResearchStore.getState().setProfitSettings({ buyPrice: -1000 });
    expect(useResearchStore.getState().profitSettings.buyPrice).toBe(0);
  });

  it('clamps NaN sellPrice to 0', () => {
    useResearchStore.getState().setProfitSettings({ sellPrice: Number('not-a-number') });
    expect(useResearchStore.getState().profitSettings.sellPrice).toBe(0);
  });

  it('clamps feeRate above 100 to 100', () => {
    useResearchStore.getState().setProfitSettings({ feeRate: 250 });
    expect(useResearchStore.getState().profitSettings.feeRate).toBe(100);
  });

  it('clamps negative feeRate to 0', () => {
    useResearchStore.getState().setProfitSettings({ feeRate: -5 });
    expect(useResearchStore.getState().profitSettings.feeRate).toBe(0);
  });

  it('accepts a valid positive shippingCost unchanged', () => {
    useResearchStore.getState().setProfitSettings({ shippingCost: 500 });
    expect(useResearchStore.getState().profitSettings.shippingCost).toBe(500);
  });

  it('manually editing buyPrice clears the buyPriceSource attribution', () => {
    useResearchStore.getState().applyPriceFromCard('buyPrice', 1000, 'メルカリ ¥1,000');
    expect(useResearchStore.getState().buyPriceSource).toBe('メルカリ ¥1,000');
    useResearchStore.getState().setProfitSettings({ buyPrice: 2000 });
    expect(useResearchStore.getState().buyPriceSource).toBeNull();
  });

  it('applyPriceFromCard clamps a negative/invalid amount to 0', () => {
    useResearchStore.getState().applyPriceFromCard('sellPrice', -50, 'ヤフオク');
    expect(useResearchStore.getState().profitSettings.sellPrice).toBe(0);
    expect(useResearchStore.getState().sellPriceSource).toBe('ヤフオク');
  });

  it('resetSession clears price source attribution', () => {
    useResearchStore.getState().applyPriceFromCard('buyPrice', 1000, 'メルカリ');
    useResearchStore.getState().resetSession();
    expect(useResearchStore.getState().buyPriceSource).toBeNull();
  });

  it('clearSearch keeps compared cards and profit settings', () => {
    useResearchStore.setState({
      query: 'PS5',
      resultCards: [
        {
          id: 'c1',
          title: 'PS5',
          siteName: 'sample',
          sourceType: 'manual',
          pageUrl: 'https://example.com/ps5',
          confidence: 'high',
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ],
      comparedCards: [
        {
          id: 'c1',
          title: 'PS5',
          siteName: 'sample',
          sourceType: 'manual',
          pageUrl: 'https://example.com/ps5',
          confidence: 'high',
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ],
      profitSettings: { ...defaultProfitSettings, buyPrice: 8000 },
    });
    useResearchStore.getState().clearSearch();
    expect(useResearchStore.getState().query).toBe('');
    expect(useResearchStore.getState().resultCards).toHaveLength(0);
    expect(useResearchStore.getState().comparedCards).toHaveLength(1);
    expect(useResearchStore.getState().profitSettings.buyPrice).toBe(8000);
  });

  it('loadResearchSession sanitizes NaN profit and javascript URLs', () => {
    useResearchStore.getState().loadResearchSession({
      query: 'x'.repeat(200),
      resultCards: [
        {
          id: 'xss',
          title: 'evil',
          siteName: 'x',
          sourceType: 'manual',
          pageUrl: 'javascript:alert(1)',
          imageUrl: 'javascript:alert(1)',
          confidence: 'high',
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ],
      comparedCards: [],
      profitSettings: {
        buyPrice: Number.NaN,
        sellPrice: Number.POSITIVE_INFINITY,
        shippingCost: -1,
        feeRate: 250,
        exchangeRate: Number.NaN,
      },
    });
    const state = useResearchStore.getState();
    expect(state.query).toHaveLength(100);
    expect(state.resultCards[0].pageUrl).toBe('');
    expect(state.resultCards[0].imageUrl).toBeUndefined();
    expect(state.profitSettings).toEqual({
      buyPrice: 0,
      sellPrice: 0,
      shippingCost: 0,
      feeRate: 100,
      exchangeRate: 0,
    });
  });
});

describe('researchStore search request identity', () => {
  beforeEach(() => {
    useResearchStore.setState({
      isSearching: false,
      searchRequestId: 0,
      query: '',
      resultCards: [],
    });
  });

  it('beginSearch は連打時に2件目を作らない', () => {
    const first = useResearchStore.getState().beginSearch();
    const second = useResearchStore.getState().beginSearch();
    expect(first).toBe(1);
    expect(second).toBeNull();
    expect(useResearchStore.getState().isSearching).toBe(true);
  });

  it('clearSearch は進行中リクエストを無効化し isSearching を落とす', () => {
    const id = useResearchStore.getState().beginSearch();
    useResearchStore.getState().clearSearch();
    expect(useResearchStore.getState().isCurrentSearchRequest(id as number)).toBe(false);
    expect(useResearchStore.getState().isSearching).toBe(false);
    expect(useResearchStore.getState().finishSearchIfCurrent(id as number)).toBe(false);
  });

  it('履歴再開中は進行中検索を無効化し、公式ライブ状態を復元しない', () => {
    const inFlight = useResearchStore.getState().beginSearch();
    useResearchStore.getState().loadResearchSession({
      query: 'Nintendo',
      resultCards: [
        {
          id: 'restored',
          title: '再開カード',
          siteName: '楽天市場',
          sourceType: 'official_api',
          pageUrl: 'https://item.rakuten.co.jp/shop/ps5/',
          confidence: 'high',
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ],
      comparedCards: [],
      profitSettings: { ...defaultProfitSettings },
      dataSourceMode: 'rakuten_mock',
    });
    expect(useResearchStore.getState().isCurrentSearchRequest(inFlight as number)).toBe(false);
    expect(useResearchStore.getState().isSearching).toBe(false);
    expect(useResearchStore.getState().searchStatus).toBeNull();
    expect(useResearchStore.getState().query).toBe('Nintendo');
    expect(useResearchStore.getState().resultCards[0]?.id).toBe('restored');
  });

  it('同じ id の比較カードは二重追加しない', () => {
    const card = {
      id: 'dup',
      title: '同じカード',
      siteName: 'sample',
      sourceType: 'manual' as const,
      pageUrl: 'https://example.com/item',
      confidence: 'high' as const,
      createdAt: '2026-08-31T00:00:00.000Z',
    };
    useResearchStore.getState().addComparedCard(card);
    useResearchStore.getState().addComparedCard(card);
    expect(useResearchStore.getState().comparedCards).toHaveLength(1);
  });

  it('persist 対象は theme / データソース / 利益設定だけで、検索中フラグは残さない', () => {
    useResearchStore.setState({
      isSearching: true,
      query: 'PS5',
      resultCards: [
        {
          id: 'c1',
          title: 'PS5',
          siteName: 'sample',
          sourceType: 'manual',
          pageUrl: 'https://example.com/ps5',
          confidence: 'high',
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ],
    });
    const persisted = JSON.parse(localStorage.getItem('coconala-tool-research') ?? '{}') as {
      state?: Record<string, unknown>;
    };
    expect(persisted.state?.isSearching).toBeUndefined();
    expect(persisted.state?.resultCards).toBeUndefined();
    expect(persisted.state?.query).toBeUndefined();
    expect(persisted.state).toHaveProperty('theme');
    expect(persisted.state).toHaveProperty('dataSourceMode');
    expect(persisted.state).toHaveProperty('profitSettings');
  });
});
