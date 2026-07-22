import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSourceMode, MarketSearchStatus, ProfitSettings, SavedResearchSession } from '../../types/market';
import type { MarketCard } from '../../types/market';

type SessionSnapshot = {
  name: string;
  query: string;
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  profitSettings: ProfitSettings;
  dataSourceMode: DataSourceMode;
  searchStatus: MarketSearchStatus | null;
  searchWarnings: string[];
  lastSearchedAt: string | null;
};

type HistoryStore = {
  sessions: SavedResearchSession[];
  saveSession: (snapshot: SessionSnapshot) => SavedResearchSession;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
};

/** localStorage 1件あたりの保存上限。超過分は古い履歴から自動的に破棄する。 */
export const MAX_SESSIONS = 20;

export const HISTORY_STORAGE_KEY = 'coconala-tool-history';

/**
 * 実際に localStorage への書き込みが成功したかを確認する。
 * zustand の persist ミドルウェアは書き込み失敗（容量超過等）を内部で
 * console.warn するだけで例外を再送出しないため、呼び出し側では検知できない。
 * そのため、保存直後に該当セッションIDが永続化データへ実際に含まれているかを確認する。
 */
export function wasSessionPersisted(sessionId: string): boolean {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return typeof raw === 'string' && raw.includes(sessionId);
  } catch {
    return false;
  }
}

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
          dataSourceMode: snapshot.dataSourceMode,
          searchStatus: snapshot.searchStatus,
          searchWarnings: snapshot.searchWarnings,
          lastSearchedAt: snapshot.lastSearchedAt,
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
      name: HISTORY_STORAGE_KEY,
    },
  ),
);
