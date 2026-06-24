import { Search, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { DataSourceModeSelector } from './DataSourceModeSelector';
import { runMarketSearch } from '../services/marketAdapters/marketSearchService';

type Props = {
  onSearch: () => void;
};

export function ProductSearchBar({ onSearch }: Props) {
  const { query, setQuery, setResultCards, dataSourceMode, resetSession } = useResearchStore();

  async function handleSearch() {
    if (!query.trim()) return;
    const response = await runMarketSearch(query, dataSourceMode, 8);
    setResultCards(response.cards);
    onSearch();
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="商品名・型番・JAN・URLを入力"
            aria-label="商品名・型番・JAN・URL"
            className="glass-input w-full py-3 pl-11 pr-10 text-sm text-ink placeholder:text-ink/40"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                resetSession();
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
          disabled={!query.trim()}
          className="shrink-0 rounded-card bg-accent bg-gradient-to-b from-white/15 to-transparent px-6 py-3 text-sm font-semibold text-white shadow-glass-2 transition hover:bg-accent-hover hover:shadow-[0_0_28px_-4px_rgb(var(--color-accent)/0.7)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-glass-2"
        >
          まとめて探す
        </button>
      </div>
      <DataSourceModeSelector />
    </div>
  );
}
