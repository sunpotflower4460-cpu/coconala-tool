import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSourceMode, MarketCard, MarketSearchResponse, MarketSearchStatus, ProfitSettings, ThemeId } from '../types/market';
import { clampAmount, clampFeeRate } from '../features/profit/profitCalculator';
import { MAX_SEARCH_QUERY_LENGTH } from '../lib/limits';
import {
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
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  dataSourceMode: DataSourceMode;
  theme: ThemeId;
  profitSettings: ProfitSettings;
  buyPriceSource: string | null;
  sellPriceSource: string | null;
  searchStatus: MarketSearchStatus | null;
  searchWarnings: string[];
  isSearching: boolean;
  lastSearchedAt: string | null;
  setQuery: (q: string) => void;
  setSearchResult: (response: MarketSearchResponse) => void;
  setIsSearching: (isSearching: boolean) => void;
  addComparedCard: (card: MarketCard) => void;
  removeComparedCard: (id: string) => void;
  isCompared: (id: string) => boolean;
  addManualCard: (card: MarketCard) => void;
  setDataSourceMode: (mode: DataSourceMode) => void;
  setTheme: (theme: ThemeId) => void;
  setProfitSettings: (settings: Partial<ProfitSettings>) => void;
  applyPriceFromCard: (field: PriceField, amount: number, source: string) => void;
  loadResearchSession: (payload: {
    query: string;
    resultCards: MarketCard[];
    comparedCards: MarketCard[];
    profitSettings: ProfitSettings;
    dataSourceMode?: DataSourceMode;
  }) => void;
  clearSearch: () => void;
  resetSession: () => void;
};

export { defaultProfitSettings };

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      query: '',
      resultCards: [],
      comparedCards: [],
      dataSourceMode: 'sample',
      theme: 'simple-pro',
      profitSettings: defaultProfitSettings,
      buyPriceSource: null,
      sellPriceSource: null,
      searchStatus: null,
      searchWarnings: [],
      isSearching: false,
      lastSearchedAt: null,

      setQuery: (q) => set({ query: q.slice(0, MAX_SEARCH_QUERY_LENGTH) }),

      setSearchResult: (response) =>
        set({
          resultCards: sanitizeCards(response.cards),
          searchStatus: response.status,
          searchWarnings: Array.isArray(response.warnings) ? response.warnings : [],
          lastSearchedAt: response.searchedAt,
        }),

      setIsSearching: (isSearching) => set({ isSearching }),

      addComparedCard: (card) => {
        const sanitized = sanitizeCards([card])[0];
        if (!sanitized) return;
        const { comparedCards } = get();
        if (comparedCards.find((c) => c.id === sanitized.id)) return;
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
          comparedCards: state.comparedCards.some((c) => c.id === sanitized.id)
            ? state.comparedCards
            : [...state.comparedCards, sanitized],
        }));
      },

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

      loadResearchSession: (payload) =>
        set({
          query: typeof payload.query === 'string' ? payload.query.slice(0, MAX_SEARCH_QUERY_LENGTH) : '',
          resultCards: sanitizeCards(payload.resultCards),
          comparedCards: sanitizeCards(payload.comparedCards),
          profitSettings: sanitizeProfitSettings(payload.profitSettings),
          dataSourceMode: sanitizeDataSourceMode(payload.dataSourceMode) ?? get().dataSourceMode,
          buyPriceSource: null,
          sellPriceSource: null,
          searchStatus: null,
          searchWarnings: [],
          lastSearchedAt: null,
        }),

      clearSearch: () =>
        set({
          query: '',
          resultCards: [],
          searchStatus: null,
          searchWarnings: [],
          isSearching: false,
          lastSearchedAt: null,
        }),

      resetSession: () =>
        set((state) => ({
          query: '',
          resultCards: [],
          comparedCards: [],
          dataSourceMode: state.dataSourceMode,
          profitSettings: defaultProfitSettings,
          buyPriceSource: null,
          sellPriceSource: null,
          searchStatus: null,
          searchWarnings: [],
          isSearching: false,
          lastSearchedAt: null,
        })),
    }),
    {
      name: RESEARCH_STORAGE_KEY,
      version: RESEARCH_PERSIST_VERSION,
      partialize: (state) => ({
        dataSourceMode: state.dataSourceMode,
        theme: state.theme,
        profitSettings: state.profitSettings,
      }),
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
