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
import { ExportPanel } from './ExportPanel';
import { ResearchHistoryPanel } from './ResearchHistoryPanel';
import { AiMemoPanel } from './AiMemoPanel';
import { ApiStatusPanel } from './ApiStatusPanel';

const sourceLegendItems = [
  { label: '公式API取得', value: 'official_api' },
  { label: '検索表示から推定', value: 'search_api' },
  { label: '検索リンク', value: 'search_link' },
  { label: '手動追加', value: 'manual' },
] as const;
const emptyResultMessageByMode = {
  sample: '該当するサンプルカードが見つかりませんでした。検索語を変えるか、手動追加をご利用ください。',
  rakuten_mock:
    '楽天APIモックでは該当カードが見つかりませんでした。検索語を変えるか、手動追加をご利用ください。',
} as const;

export function AppShell() {
  const { resultCards, query, comparedCards, dataSourceMode } = useResearchStore();
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [searched, setSearched] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  const shortcuts = buildSearchLinks(query);
  const hasResults = resultCards.length > 0;

  return (
    <div className="min-h-screen px-3 py-5 sm:px-4 sm:py-8 md:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 md:mb-8">
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
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          デモ版 / サンプルデータ: 現在は実API接続前のMVPです。検索表示由来の価格は推定です。
        </div>
        <ProductSearchBar onSearch={() => setSearched(true)} />
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-slate-200">はじめての3ステップ</h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-xs text-slate-300">
            <li>商品名を入れる</li>
            <li>気になる価格カードを比較に追加</li>
            <li>利益と元ページを確認</li>
          </ol>
        </section>
      </header>

      {/* Empty state */}
      {!searched && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center sm:py-20">
          <BarChart2 size={40} className="text-slate-600" />
          <p className="text-base font-medium text-slate-300">商品名・型番・JAN・URLを入力して「まとめて探す」</p>
          <p className="text-xs text-slate-500">
            例: SONY Walkman NW-A55 / Nintendo 3DS LL / JANコード / 商品URL
          </p>
        </div>
      )}

      {/* Main layout */}
      {searched && (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left: results */}
          <div className="flex flex-1 flex-col gap-6 min-w-0">
            <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] font-semibold text-slate-300">スクリーンショット向け表示エリア</p>
              <p className="mt-1 text-xs text-slate-400">
                価格カード・比較ボード・利益見込みを一画面で見せるデモレイアウトです。
              </p>
            </section>
            {/* Search shortcuts */}
            {shortcuts.length > 0 && <SearchShortcutCard shortcuts={shortcuts} />}

            {manualSuccess && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                手動カードを追加しました。比較ボードと利益計算に反映されています。
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p className="mb-2 text-[11px] text-slate-400">ソース凡例</p>
              <div className="flex flex-wrap gap-1.5">
                {sourceLegendItems.map((item) => (
                  <span key={item.value} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

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

            {!hasResults && (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                {emptyResultMessageByMode[dataSourceMode]}
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
            <ExportPanel />
            <ResearchHistoryPanel onLoadSession={() => setSearched(true)} />
            <AiMemoPanel />
            <ApiStatusPanel />
          </aside>
        </div>
      )}

      {/* Manual add modal */}
      {showManualAdd && (
        <ManualAddPanel
          onClose={() => setShowManualAdd(false)}
          onSuccess={() => {
            setManualSuccess(true);
            window.setTimeout(() => setManualSuccess(false), 2500);
          }}
        />
      )}
    </div>
  );
}
