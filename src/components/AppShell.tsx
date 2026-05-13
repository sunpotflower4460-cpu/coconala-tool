import { useState } from 'react';
import { useResearchStore } from '../store/researchStore';
import { ProductSearchBar } from './ProductSearchBar';
import { ResultCard } from './ResultCard';
import { CompareBoard } from './CompareBoard';
import { ProfitPanel } from './ProfitPanel';
import { ThemeSelector } from './ThemeSelector';
import { SearchShortcutCard } from './SearchShortcutCard';
import { ManualAddPanel } from '../features/manualAdd/ManualAddPanel';
import { buildSearchLinks } from '../services/searchLinkBuilder';
import { PlusCircle, BarChart2 } from 'lucide-react';

export function AppShell() {
  const { resultCards, query, comparedCards } = useResearchStore();
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [searched, setSearched] = useState(false);

  const shortcuts = buildSearchLinks(query);
  const hasResults = resultCards.length > 0;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent/70">
              Market Card Research App
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Coconala Tool
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              商品名を入れて、まとめて探す。画像つきカードで相場を見る。
            </p>
          </div>
          <ThemeSelector />
        </div>
        <ProductSearchBar onSearch={() => setSearched(true)} />
      </header>

      {/* Empty state */}
      {!searched && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <BarChart2 size={40} className="text-slate-600" />
          <p className="text-base font-medium text-slate-400">商品名・型番・JANを入力して「まとめて探す」</p>
          <p className="text-xs text-slate-500">サンプルデータが表示されます</p>
        </div>
      )}

      {/* Main layout */}
      {searched && (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left: results */}
          <div className="flex flex-1 flex-col gap-6 min-w-0">
            {/* Search shortcuts */}
            {shortcuts.length > 0 && <SearchShortcutCard shortcuts={shortcuts} />}

            {/* Card grid */}
            {hasResults && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-300">
                    検索結果 ({resultCards.length}件)
                  </h2>
                  <button
                    onClick={() => setShowManualAdd(true)}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                  >
                    <PlusCircle size={13} />
                    手動で追加
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {resultCards.map((card) => (
                    <ResultCard key={card.id} card={card} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-300">
                比較ボード ({comparedCards.length}件)
              </h2>
              <CompareBoard />
            </div>
            <ProfitPanel />
          </aside>
        </div>
      )}

      {/* Manual add modal */}
      {showManualAdd && <ManualAddPanel onClose={() => setShowManualAdd(false)} />}
    </div>
  );
}
