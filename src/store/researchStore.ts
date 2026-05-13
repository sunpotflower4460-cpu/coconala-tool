import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketCard, ProfitSettings, ThemeId } from '../types/market';

type ResearchStore = {
  query: string;
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  theme: ThemeId;
  profitSettings: ProfitSettings;
  setQuery: (q: string) => void;
  setResultCards: (cards: MarketCard[]) => void;
  addComparedCard: (card: MarketCard) => void;
  removeComparedCard: (id: string) => void;
  isCompared: (id: string) => boolean;
  addManualCard: (card: MarketCard) => void;
  setTheme: (theme: ThemeId) => void;
  setProfitSettings: (settings: Partial<ProfitSettings>) => void;
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
      theme: 'simple-pro',
      profitSettings: defaultProfitSettings,

      setQuery: (q) => set({ query: q }),

      setResultCards: (cards) => set({ resultCards: cards }),

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

      setTheme: (theme) => set({ theme }),

      setProfitSettings: (settings) => {
        set((state) => ({
          profitSettings: { ...state.profitSettings, ...settings },
        }));
      },

      resetSession: () =>
        set({
          query: '',
          resultCards: [],
          comparedCards: [],
          profitSettings: defaultProfitSettings,
        }),
    }),
    {
      name: 'coconala-tool-research',
      partialize: (state) => ({
        theme: state.theme,
        profitSettings: state.profitSettings,
      }),
    },
  ),
);
