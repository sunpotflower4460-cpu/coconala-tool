import { Search, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useResearchStore } from '../store/researchStore';
import { DataSourceModeSelector } from './DataSourceModeSelector';
import { runMarketSearch } from '../services/marketAdapters/marketSearchService';
import { MAX_SEARCH_QUERY_LENGTH } from '../lib/limits';

export function ProductSearchBar() {
  const { query, setQuery, setSearchResult, isSearching, dataSourceMode, clearSearch } = useResearchStore(
    useShallow((s) => ({
      query: s.query,
      setQuery: s.setQuery,
      setSearchResult: s.setSearchResult,
      isSearching: s.isSearching,
      dataSourceMode: s.dataSourceMode,
      clearSearch: s.clearSearch,
    })),
  );

  async function handleSearch() {
    const requestedQuery = query.trim();
    const requestedMode = dataSourceMode;
    if (!requestedQuery) return;

    const requestId = useResearchStore.getState().beginSearch();
    if (requestId === null) return;

    try {
      const response = await runMarketSearch(requestedQuery, requestedMode, 8);
      const current = useResearchStore.getState();

      // 同一クエリでも、クリア後の再検索や連打で生まれた古い世代は捨てる。
      if (!current.isCurrentSearchRequest(requestId)) return;
      if (current.query.trim() !== requestedQuery || current.dataSourceMode !== requestedMode) return;

      setSearchResult(response, requestedQuery);
    } finally {
      useResearchStore.getState().finishSearchIfCurrent(requestId);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // 日本語入力の変換確定の Enter では検索しない（入力途中の語で検索が走るのを防ぐ）。
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    void handleSearch();
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/50 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            maxLength={MAX_SEARCH_QUERY_LENGTH}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="商品名・型番・JAN・URLを入力"
            aria-label="商品名・型番・JAN・URL"
            className="glass-input w-full py-3 pl-11 pr-12 text-sm text-ink placeholder:text-ink/40"
          />
          {query && (
            <button
              onClick={() => {
                clearSearch();
              }}
              aria-label="検索内容をクリア"
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink/50 hover:text-ink transition"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => void handleSearch()}
          disabled={!query.trim() || isSearching}
          aria-busy={isSearching}
          className="shrink-0 rounded-card bg-accent-strong px-6 py-3 text-sm font-semibold text-on-accent shadow-glass-2 transition hover:brightness-110 hover:shadow-[0_0_28px_-4px_rgb(var(--color-accent)/0.7)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-glass-2"
        >
          {isSearching ? '検索中…' : 'まとめて探す'}
        </button>
      </div>
      <DataSourceModeSelector />
    </div>
  );
}
