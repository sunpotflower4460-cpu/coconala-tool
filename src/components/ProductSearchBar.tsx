import { Search, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { DataSourceModeSelector } from './DataSourceModeSelector';
import { runMarketSearch } from '../services/marketAdapters/marketSearchService';
import { MAX_SEARCH_QUERY_LENGTH } from '../lib/limits';

type Props = {
  onSearch: () => void;
};

export function ProductSearchBar({ onSearch }: Props) {
  const { query, setQuery, setSearchResult, setIsSearching, isSearching, dataSourceMode, clearSearch } =
    useResearchStore();

  async function handleSearch() {
    const requestedQuery = query.trim();
    const requestedMode = dataSourceMode;
    if (!requestedQuery || isSearching) return;

    setIsSearching(true);
    try {
      const response = await runMarketSearch(requestedQuery, requestedMode, 8);
      const current = useResearchStore.getState();

      // 検索中にユーザーがクエリを編集・クリアしたり、データソースを切り替えた場合、
      // 遅れて返ってきた旧リクエストの結果で現在の画面状態を上書きしない。
      if (current.query.trim() !== requestedQuery || current.dataSourceMode !== requestedMode) return;

      setSearchResult(response);
      onSearch();
    } finally {
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void handleSearch();
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
            className="glass-input w-full py-3 pl-11 pr-10 text-sm text-ink placeholder:text-ink/40"
          />
          {query && (
            <button
              onClick={() => {
                clearSearch();
              }}
              aria-label="検索内容をクリア"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink transition"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => void handleSearch()}
          disabled={!query.trim() || isSearching}
          aria-busy={isSearching}
          className="shrink-0 rounded-card bg-accent bg-gradient-to-b from-white/15 to-transparent px-6 py-3 text-sm font-semibold text-white shadow-glass-2 transition hover:bg-accent-hover hover:shadow-[0_0_28px_-4px_rgb(var(--color-accent)/0.7)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-glass-2"
        >
          {isSearching ? '検索中…' : 'まとめて探す'}
        </button>
      </div>
      <DataSourceModeSelector />
    </div>
  );
}
