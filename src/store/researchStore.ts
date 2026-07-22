import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSourceMode, MarketCard, MarketSearchResponse, MarketSearchStatus, ProfitSettings, ThemeId } from '../types/market';

type ResearchStore = {
  query: string;
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  dataSourceMode: DataSourceMode;
  theme: ThemeId;
  profitSettings: ProfitSettings;
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
  loadResearchSession: (payload: {
    query: string;
    resultCards: MarketCard[];
    comparedCards: MarketCard[];
    profitSettings: ProfitSettings;
  }) => void;
  resetSession: () => void;
};

const defaultProfitSettings: ProfitSettings = {
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 0,
  feeRate: 10,
  exchangeRate: 155,
};

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      query: '',
      resultCards: [],
      comparedCards: [],
      dataSourceMode: 'sample',
      theme: 'simple-pro',
      profitSettings: defaultProfitSettings,
      searchStatus: null,
      searchWarnings: [],
      isSearching: false,
      lastSearchedAt: null,

      setQuery: (q) => set({ query: q }),

      setSearchResult: (response) =>
        set({
          resultCards: response.cards,
          searchStatus: response.status,
          searchWarnings: response.warnings,
          lastSearchedAt: response.searchedAt,
        }),

      setIsSearching: (isSearching) => set({ isSearching }),

      addComparedCard: (card) => {
        const { comparedCards } = get();
        if (comparedCards.find((c) => c.id === card.id)) return;
        set({ comparedCards: [...comparedCards, card] });
      },

      removeComparedCard: (id) => {
        set((state) => ({
          comparedCards: state.comparedCards.filter((c) => c.id !== id),
        }));
      },

      isCompared: (id) => get().comparedCards.some((c) => c.id === id),

      addManualCard: (card) => {
        set((state) => ({
          resultCards: [card, ...state.resultCards],
          comparedCards: [...state.comparedCards, card],
        }));
      },

      setDataSourceMode: (mode) => set({ dataSourceMode: mode }),

      setTheme: (theme) => set({ theme }),

      setProfitSettings: (settings) => {
        set((state) => ({
          profitSettings: { ...state.profitSettings, ...settings },
        }));
      },

      loadResearchSession: (payload) =>
        set({
          query: payload.query,
          resultCards: payload.resultCards,
          comparedCards: payload.comparedCards,
          profitSettings: payload.profitSettings,
        }),

      resetSession: () =>
        set((state) => ({
          query: '',
          resultCards: [],
          comparedCards: [],
          dataSourceMode: state.dataSourceMode,
          profitSettings: defaultProfitSettings,
          searchStatus: null,
          searchWarnings: [],
          isSearching: false,
          lastSearchedAt: null,
        })),
    }),
    {
      name: 'coconala-tool-research',
      partialize: (state) => ({
        dataSourceMode: state.dataSourceMode,
        theme: state.theme,
        profitSettings: state.profitSettings,
      }),
    },
  ),
);
