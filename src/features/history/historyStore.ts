import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSourceMode, MarketSearchStatus, ProfitSettings, SavedResearchSession } from '../../types/market';
import type { MarketCard } from '../../types/market';
import { MAX_HISTORY_NAME_LENGTH, MAX_SEARCH_QUERY_LENGTH } from '../../lib/limits';
import {
  HISTORY_PERSIST_VERSION,
  HISTORY_STORAGE_KEY,
  sanitizeCards,
  sanitizeDataSourceMode,
  sanitizeHistoryPersisted,
  sanitizeProfitSettings,
} from '../../lib/persistSanitize';

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

export { HISTORY_STORAGE_KEY };

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
          name: snapshot.name.trim().slice(0, MAX_HISTORY_NAME_LENGTH) || `${snapshot.query || 'リサーチ'} ${new Date().toLocaleString()}`,
          query: snapshot.query.slice(0, MAX_SEARCH_QUERY_LENGTH),
          resultCards: sanitizeCards(snapshot.resultCards),
          comparedCards: sanitizeCards(snapshot.comparedCards),
          profitSettings: sanitizeProfitSettings(snapshot.profitSettings),
          dataSourceMode: sanitizeDataSourceMode(snapshot.dataSourceMode) ?? 'sample',
          searchStatus: snapshot.searchStatus,
          searchWarnings: Array.isArray(snapshot.searchWarnings) ? snapshot.searchWarnings : [],
          lastSearchedAt: snapshot.lastSearchedAt,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          sessions: [saved, ...state.sessions].slice(0, MAX_SESSIONS),
        }));

        if (!wasSessionPersisted(saved.id)) {
          set((state) => ({
            sessions: state.sessions.filter((session) => session.id !== saved.id),
          }));
        }

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
      version: HISTORY_PERSIST_VERSION,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizeHistoryPersisted(persistedState),
      }),
    },
  ),
);

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === HISTORY_STORAGE_KEY) {
      void useHistoryStore.persist.rehydrate();
    }
  });
}
