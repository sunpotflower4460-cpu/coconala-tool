import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProfitSettings, SavedResearchSession } from '../../types/market';
import type { MarketCard } from '../../types/market';

type SessionSnapshot = {
  name: string;
  query: string;
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  profitSettings: ProfitSettings;
};

type HistoryStore = {
  sessions: SavedResearchSession[];
  saveSession: (snapshot: SessionSnapshot) => SavedResearchSession;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
};

const MAX_SESSIONS = 20;

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      sessions: [],
      saveSession: (snapshot) => {
        const now = new Date().toISOString();
        const saved: SavedResearchSession = {
          id: createSessionId(),
          name: snapshot.name,
          query: snapshot.query,
          resultCards: snapshot.resultCards,
          comparedCards: snapshot.comparedCards,
          profitSettings: snapshot.profitSettings,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          sessions: [saved, ...state.sessions].slice(0, MAX_SESSIONS),
        }));
        return saved;
      },
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
        })),
      clearAllSessions: () => set({ sessions: [] }),
    }),
    {
      name: 'coconala-tool-history',
    },
  ),
);
