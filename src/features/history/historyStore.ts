import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSourceMode, MarketSearchStatus, ProfitSettings, SavedResearchSession } from '../../types/market';
import type { MarketCard } from '../../types/market';
import { MAX_HISTORY_NAME_LENGTH, MAX_SEARCH_QUERY_LENGTH } from '../../lib/limits';
import {
  HISTORY_PERSIST_VERSION,
  HISTORY_STORAGE_KEY,
  migrateHistoryPersisted,
  sanitizeCards,
  sanitizeDataSourceMode,
  sanitizeHistoryPersisted,
  sanitizeLastSearchedAt,
  sanitizeProfitSettings,
  sanitizeSearchStatus,
  sanitizeSearchWarnings,
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
    (set, get) => ({
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
          searchStatus: sanitizeSearchStatus(snapshot.searchStatus),
          searchWarnings: sanitizeSearchWarnings(snapshot.searchWarnings),
          lastSearchedAt: sanitizeLastSearchedAt(snapshot.lastSearchedAt),
          createdAt: now,
          updatedAt: now,
        };

        const beforeSessions = get().sessions;
        try {
          set({
            sessions: [saved, ...beforeSessions].slice(0, MAX_SESSIONS),
          });
        } catch {
          // persist の setItem が同期例外でも、メモリ更新は先に完了している。
        }

        if (!wasSessionPersisted(saved.id)) {
          // 上限超過で古い1件を落としたあとに永続化が失敗すると、新件だけ消すと
          // 元の最古セッションが戻らず件数が減る。保存前の配列そのものへ戻す。
          try {
            set({ sessions: beforeSessions });
          } catch {
            // rollback の persist が再度失敗しても、メモリ上は保存前へ戻っている。
          }
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
      migrate: (persistedState, fromVersion) => migrateHistoryPersisted(persistedState, fromVersion),
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
