import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSourceMode, MarketCard, MarketSearchResponse, MarketSearchStatus, ProfitSettings, ThemeId } from '../types/market';
import { clampAmount, clampFeeRate } from '../features/profit/profitCalculator';

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
      buyPriceSource: null,
      sellPriceSource: null,
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
          profitSettings: {
            ...state.profitSettings,
            ...(settings.buyPrice !== undefined && { buyPrice: clampAmount(settings.buyPrice) }),
            ...(settings.sellPrice !== undefined && { sellPrice: clampAmount(settings.sellPrice) }),
            ...(settings.shippingCost !== undefined && { shippingCost: clampAmount(settings.shippingCost) }),
            ...(settings.feeRate !== undefined && { feeRate: clampFeeRate(settings.feeRate) }),
            ...(settings.exchangeRate !== undefined && { exchangeRate: clampAmount(settings.exchangeRate) }),
          },
          // 手動入力は、その項目のカード由来表示をクリアする。
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
          query: payload.query,
          resultCards: payload.resultCards,
          comparedCards: payload.comparedCards,
          profitSettings: payload.profitSettings,
          ...(payload.dataSourceMode !== undefined && { dataSourceMode: payload.dataSourceMode }),
          buyPriceSource: null,
          sellPriceSource: null,
          // 履歴からの復元はライブな検索結果ではないため、直近の検索状態バッジは表示しない。
          searchStatus: null,
          searchWarnings: [],
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
      name: 'coconala-tool-research',
      partialize: (state) => ({
        dataSourceMode: state.dataSourceMode,
        theme: state.theme,
        profitSettings: state.profitSettings,
      }),
    },
  ),
);
