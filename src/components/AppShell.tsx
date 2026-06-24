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
import { DemoModeNotice } from './DemoModeNotice';

const sourceLegendItems = [
  { label: '公式API取得', value: 'official_api' },
  { label: '検索表示から推定', value: 'search_api' },
  { label: '検索リンク', value: 'search_link' },
  { label: '手動追加', value: 'manual' },
] as const;
const emptyResultMessageByMode = {
  sample: '該当するサンプルカードが見つかりませんでした。検索語を変えるか、手動追加をご利用ください。',
  rakuten_mock:
    '楽天APIモックでは該当カードが見つかりませんでした。「PS5」「SONY」「Nintendo」を試すか、サンプルモードに切り替えて画面フローを確認してください。',
} as const;

export function AppShell() {
  const { resultCards, query, comparedCards, dataSourceMode } = useResearchStore();
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [searched, setSearched] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  const shortcuts = buildSearchLinks(query);
  const hasResults = resultCards.length > 0;

  return (
    <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8">
      {/* Sticky glass top bar: title + persistent demo badge + theme selector */}
      <header className="sticky top-0 z-30 mb-6 md:mb-8">
        <div className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/80">
              Market Card Research
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Coconala Tool</h1>
              <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-100">
                デモ表示中 — サンプル/モックデータ
              </span>
            </div>
          </div>
          <ThemeSelector />
        </div>
      </header>

      {/* Intro: tagline, detailed demo banner, search, steps */}
      <section className="mb-6 flex flex-col gap-4 md:mb-8">
        <p className="text-sm text-ink/70">
          商品名を入れて、まとめて探す。画像つきカードで相場を見る。
        </p>
        <div className="glass border-amber-300/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-50">
          デモ表示中 — サンプル/モックデータ。主要フロー（検索・比較・利益計算・CSV出力）を確認できます。楽天APIキーを設定した場合のみ実データに切り替わります。検索表示由来の価格は推定です。
        </div>
        <ProductSearchBar onSearch={() => setSearched(true)} />
        <DemoModeNotice />
        <section className="glass px-4 py-3.5">
          <h2 className="font-display text-sm font-semibold text-ink">はじめての3ステップ</h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-xs text-ink/70">
            <li>商品名を入れる</li>
            <li>気になる価格カードを比較に追加</li>
            <li>利益と元ページを確認</li>
          </ol>
        </section>
      </section>

      {/* Empty state */}
      {!searched && (
        <div className="glass flex flex-col items-center justify-center gap-4 border-dashed px-4 py-16 text-center sm:py-20">
          <BarChart2 size={40} className="text-accent/60" />
          <p className="text-base font-medium text-ink/80">商品名・型番・JAN・URLを入力して「まとめて探す」</p>
          <p className="text-xs text-ink/50">
            例: SONY Walkman NW-A55 / Nintendo 3DS LL / JANコード / 商品URL
          </p>
        </div>
      )}

      {/* Main layout */}
      {searched && (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left: results */}
          <div className="flex flex-1 flex-col gap-6 min-w-0">
            {/* Search shortcuts */}
            {shortcuts.length > 0 && <SearchShortcutCard shortcuts={shortcuts} />}

            {manualSuccess && (
              <div className="glass border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-100">
                手動カードを追加しました。比較ボードと利益計算に反映されています。
              </div>
            )}

            <div className="glass px-3.5 py-3 text-xs text-ink/70">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-ink/50">ソース凡例</p>
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
                  <h2 className="font-display text-sm font-semibold text-ink/80">
                    検索結果 <span className="num">({resultCards.length}件)</span>
                  </h2>
                  <button
                    onClick={() => setShowManualAdd(true)}
                    className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10"
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
              <div className="glass border-dashed px-4 py-4 text-sm text-ink/70">
                {emptyResultMessageByMode[dataSourceMode]}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-semibold text-ink/80">
                比較ボード <span className="num">({comparedCards.length}件)</span>
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
