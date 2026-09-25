import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DataSourceMode, MarketCard, MarketId, MarketSearchResponse, MarketSearchStatus, ProfitSettings, SourceResult, ThemeId } from '../types/market';
import { MARKET_LABELS } from '../types/market';
import { clampAmount, clampFeeRate } from '../features/profit/profitCalculator';
import { MAX_SEARCH_QUERY_LENGTH } from '../lib/limits';
import {
  MAX_COMPARED_CARDS,
  RESEARCH_PERSIST_VERSION,
  RESEARCH_STORAGE_KEY,
  defaultProfitSettings,
  sanitizeCards,
  sanitizeDataSourceMode,
  sanitizeProfitSettings,
  sanitizeResearchPersisted,
  sanitizeThemeId,
} from '../lib/persistSanitize';

type PriceField = 'buyPrice' | 'sellPrice';

type ResearchStore = {
  query: string;
  /** 直近に検索（または履歴から再開）した語。入力欄の編集途中の値とは別に持つ。 */
  searchedQuery: string;
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  dataSourceMode: DataSourceMode;
  theme: ThemeId;
  profitSettings: ProfitSettings;
  buyPriceSource: string | null;
  sellPriceSource: string | null;
  searchStatus: MarketSearchStatus | null;
  searchWarnings: string[];
  /** まとめて検索のときの、サイトごとの結果（保存しない）。 */
  searchSources: SourceResult[];
  isSearching: boolean;
  lastSearchedAt: string | null;
  /** 進行中の検索リクエスト世代。clear / 新しい検索で増やす。 */
  searchRequestId: number;
  setQuery: (q: string) => void;
  setSearchResult: (response: MarketSearchResponse, searchedQuery?: string) => void;
  /** 検索開始。既に検索中なら null。呼び出し側は最新世代以外の結果を捨てる。 */
  beginSearch: () => number | null;
  isCurrentSearchRequest: (requestId: number) => boolean;
  finishSearchIfCurrent: (requestId: number) => boolean;
  addComparedCard: (card: MarketCard) => void;
  removeComparedCard: (id: string) => void;
  isCompared: (id: string) => boolean;
  addManualCard: (card: MarketCard) => void;
  /** 検索リンクで開いたサイト（メルカリ等）で見た価格を、相場一覧に1件加える。比較ボードには入れない。 */
  addObservedPrice: (entry: { market: MarketId; price: number; pageUrl: string; query: string }) => void;
  removeResultCard: (id: string) => void;
  /** 検索ページからコピーして貼り付けた価格（相場一覧だけに使い、検索結果の一覧には出さない）。 */
  pastedCards: MarketCard[];
  /** そのサイトの貼り付け価格を置き換える（貼り直し＝入れ替え）。 */
  setPastedPrices: (entry: { market: MarketId; prices: number[]; pageUrl: string; query: string }) => void;
  clearPastedPrices: (market: MarketId) => void;
  setDataSourceMode: (mode: DataSourceMode) => void;
  setTheme: (theme: ThemeId) => void;
  setProfitSettings: (settings: Partial<ProfitSettings>) => void;
  applyPriceFromCard: (field: PriceField, amount: number, source: string) => void;
  loadResearchSession: (payload: {
    query: string;
    resultCards: MarketCard[];
    comparedCards: MarketCard[];
    profitSettings: ProfitSettings;
  }) => void;
  clearSearch: () => void;
  resetSession: () => void;
};

export { defaultProfitSettings };

/**
 * 保存に失敗しても（容量超過・保存禁止のブラウザ）操作を止めない localStorage ラッパー。
 * 画面上の値はそのまま使え、次に保存できたときに反映される。
 */
const safeLocalStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 容量超過など。設定・比較ボードの保存だけを諦め、画面操作は続けられるようにする。
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 何もしない
    }
  },
};

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      query: '',
      searchedQuery: '',
      resultCards: [],
      comparedCards: [],
      dataSourceMode: 'multi',
      theme: 'simple-pro',
      profitSettings: defaultProfitSettings,
      buyPriceSource: null,
      sellPriceSource: null,
      searchStatus: null,
      searchWarnings: [],
      searchSources: [],
      pastedCards: [],
      isSearching: false,
      lastSearchedAt: null,
      searchRequestId: 0,

      setQuery: (q) => set({ query: q.slice(0, MAX_SEARCH_QUERY_LENGTH) }),

      setSearchResult: (response, searchedQuery) =>
        set((state) => ({
          searchedQuery: (searchedQuery ?? state.query).trim().slice(0, MAX_SEARCH_QUERY_LENGTH),
          resultCards: sanitizeCards(response.cards),
          searchStatus: response.status,
          searchWarnings: Array.isArray(response.warnings) ? response.warnings : [],
          searchSources: Array.isArray(response.sources) ? response.sources : [],
          pastedCards: [],
          lastSearchedAt: response.searchedAt,
        })),

      beginSearch: () => {
        if (get().isSearching) return null;
        const searchRequestId = get().searchRequestId + 1;
        set({ searchRequestId, isSearching: true });
        return searchRequestId;
      },

      isCurrentSearchRequest: (requestId) => get().searchRequestId === requestId,

      finishSearchIfCurrent: (requestId) => {
        if (get().searchRequestId !== requestId) return false;
        set({ isSearching: false });
        return true;
      },

      addComparedCard: (card) => {
        const sanitized = sanitizeCards([card])[0];
        if (!sanitized) return;
        const { comparedCards } = get();
        if (comparedCards.find((c) => c.id === sanitized.id)) return;
        if (comparedCards.length >= MAX_COMPARED_CARDS) return;
        set({ comparedCards: [...comparedCards, sanitized] });
      },

      removeComparedCard: (id) => {
        set((state) => ({
          comparedCards: state.comparedCards.filter((c) => c.id !== id),
        }));
      },

      isCompared: (id) => get().comparedCards.some((c) => c.id === id),

      addManualCard: (card) => {
        const sanitized = sanitizeCards([card])[0];
        if (!sanitized) return;
        set((state) => ({
          resultCards: [sanitized, ...state.resultCards],
          comparedCards:
            state.comparedCards.some((c) => c.id === sanitized.id) || state.comparedCards.length >= MAX_COMPARED_CARDS
              ? state.comparedCards
            : [...state.comparedCards, sanitized],
        }));
      },

      addObservedPrice: ({ market, price, pageUrl, query }) => {
        const label = MARKET_LABELS[market];
        const card = sanitizeCards([
          {
            id: `observed-${market}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: `${query || '検索結果'}（${label}で確認した価格）`,
            siteName: label,
            sourceType: 'manual',
            priceText: `¥${Math.round(price).toLocaleString('ja-JP')}`,
            priceValue: price,
            currency: 'JPY',
            pageUrl,
            confidence: 'medium',
            note: `${label}の検索ページで確認した価格（手動入力）`,
            createdAt: new Date().toISOString(),
            market,
          },
        ])[0];
        if (!card) return;
        set((state) => ({ resultCards: [...state.resultCards, card] }));
      },

      setPastedPrices: ({ market, prices, pageUrl, query }) => {
        const label = MARKET_LABELS[market];
        const createdAt = new Date().toISOString();
        const cards = sanitizeCards(
          prices.map((price, i) => ({
            id: `pasted-${market}-${i}`,
            title: `${query || '検索結果'}（${label}の検索表示から推定）`,
            siteName: label,
            sourceType: 'search_api',
            priceText: `¥${Math.round(price).toLocaleString('ja-JP')}`,
            priceValue: price,
            currency: 'JPY',
            pageUrl,
            confidence: 'low',
            note: `${label}の検索ページからコピーした価格（検索表示から推定）`,
            createdAt,
            market,
          })),
        );
        set((state) => ({ pastedCards: [...state.pastedCards.filter((c) => c.market !== market), ...cards] }));
      },

      clearPastedPrices: (market) => set((state) => ({ pastedCards: state.pastedCards.filter((c) => c.market !== market) })),

      removeResultCard: (id) => set((state) => ({ resultCards: state.resultCards.filter((c) => c.id !== id) })),

      setDataSourceMode: (mode) => {
        const next = sanitizeDataSourceMode(mode);
        if (!next) return;
        set({ dataSourceMode: next });
      },

      setTheme: (theme) => {
        const next = sanitizeThemeId(theme);
        if (!next) return;
        set({ theme: next });
      },

      setProfitSettings: (settings) => {
        set((state) => ({
          profitSettings: {
            ...state.profitSettings,
            ...(settings.buyPrice !== undefined && { buyPrice: clampAmount(settings.buyPrice) }),
            ...(settings.sellPrice !== undefined && { sellPrice: clampAmount(settings.sellPrice) }),
            ...(settings.shippingCost !== undefined && { shippingCost: clampAmount(settings.shippingCost) }),
            ...(settings.feeRate !== undefined && { feeRate: clampFeeRate(settings.feeRate) }),
            ...(settings.exchangeRate !== undefined && { exchangeRate: clampAmount(settings.exchangeRate) }),
          },
          ...(settings.buyPrice !== undefined && { buyPriceSource: null }),
          ...(settings.sellPrice !== undefined && { sellPriceSource: null }),
        }));
      },

      applyPriceFromCard: (field, amount, source) => {
        set((state) => ({
          profitSettings: { ...state.profitSettings, [field]: clampAmount(amount) },
          ...(field === 'buyPrice' ? { buyPriceSource: source } : { sellPriceSource: source }),
        }));
      },

      loadResearchSession: (payload) => {
        const query = typeof payload.query === 'string' ? payload.query.slice(0, MAX_SEARCH_QUERY_LENGTH) : '';
        set({
          query,
          searchedQuery: query.trim(),
          resultCards: sanitizeCards(payload.resultCards),
          comparedCards: sanitizeCards(payload.comparedCards),
          profitSettings: sanitizeProfitSettings(payload.profitSettings),
          // データソースは利用者の現在の選択を維持する（古い履歴を開いただけで楽天→サンプルに切り替えない）。
          buyPriceSource: null,
          sellPriceSource: null,
          // 保存スナップショットはライブな検索状態ではない。進行中リクエストも無効化する。
          searchStatus: null,
          searchWarnings: [],
          searchSources: [],
          pastedCards: [],
          lastSearchedAt: null,
          isSearching: false,
          searchRequestId: get().searchRequestId + 1,
        });
      },

      clearSearch: () =>
        set((state) => ({
          query: '',
          searchedQuery: '',
          resultCards: [],
          searchStatus: null,
          searchWarnings: [],
          searchSources: [],
          pastedCards: [],
          isSearching: false,
          lastSearchedAt: null,
          searchRequestId: state.searchRequestId + 1,
        })),

      resetSession: () =>
        set((state) => ({
          query: '',
          searchedQuery: '',
          resultCards: [],
          comparedCards: [],
          dataSourceMode: state.dataSourceMode,
          profitSettings: defaultProfitSettings,
          buyPriceSource: null,
          sellPriceSource: null,
          searchStatus: null,
          searchWarnings: [],
          searchSources: [],
          pastedCards: [],
          isSearching: false,
          lastSearchedAt: null,
          searchRequestId: state.searchRequestId + 1,
        })),
    }),
    {
      name: RESEARCH_STORAGE_KEY,
      storage: createJSONStorage(() => safeLocalStorage),
      version: RESEARCH_PERSIST_VERSION,
      partialize: (state) => ({
        dataSourceMode: state.dataSourceMode,
        theme: state.theme,
        profitSettings: state.profitSettings,
        comparedCards: state.comparedCards,
      }),
      // v1 → v2: 比較ボードも保存対象に追加。旧データは設定だけ引き継ぎ、壊れた値は捨てる。
      migrate: (persistedState) => sanitizeResearchPersisted(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizeResearchPersisted(persistedState),
      }),
    },
  ),
);

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === RESEARCH_STORAGE_KEY) {
      void useResearchStore.persist.rehydrate();
    }
  });
}
