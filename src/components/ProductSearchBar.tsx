import { Search, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { sampleMarketCards } from '../data/sampleMarketCards';
import { DataSourceModeSelector } from './DataSourceModeSelector';
import { rakutenAdapter } from '../services/marketAdapters/rakutenAdapter';

type Props = {
  onSearch: () => void;
};

export function ProductSearchBar({ onSearch }: Props) {
  const { query, setQuery, setResultCards, dataSourceMode, resetSession } = useResearchStore();

  async function handleSearch() {
    if (!query.trim()) return;
    if (dataSourceMode === 'sample') {
      setResultCards(sampleMarketCards.map((card) => ({ ...card, demoOrigin: 'sample' as const })));
    } else {
      const response = await rakutenAdapter.search({ query, limit: 8 });
      setResultCards(response.cards);
    }
    onSearch();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void handleSearch();
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="商品名・型番・JAN・URLを入力"
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 pl-11 pr-10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-accent/60 focus:bg-white/10 transition"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                resetSession();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => void handleSearch()}
          disabled={!query.trim()}
          className="shrink-0 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          まとめて探す
        </button>
      </div>
      <DataSourceModeSelector />
    </div>
  );
}
