import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { SOURCE_TYPE_LABELS, isDemoSearchStatus, type SourceType } from '../types/market';

const sourceLegendItems: SourceType[] = ['official_api', 'search_api', 'search_link', 'manual'];

const statusBannerClassByStatus: Record<string, string> = {
  official_api: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  empty: 'border-sky-300/30 bg-sky-500/10 text-sky-50',
  invalid_query: 'border-sky-300/30 bg-sky-500/10 text-sky-50',
  sample: 'border-white/15 bg-white/5 text-ink/70',
  mock_no_key: 'border-amber-300/30 bg-amber-500/10 text-amber-50',
  mock_setup_error: 'border-amber-300/30 bg-amber-500/10 text-amber-50',
  mock_timeout: 'border-amber-300/30 bg-amber-500/10 text-amber-50',
  mock_network: 'border-amber-300/30 bg-amber-500/10 text-amber-50',
  mock_rate_limited: 'border-amber-300/30 bg-amber-500/10 text-amber-50',
  mock_upstream_error: 'border-amber-300/30 bg-amber-500/10 text-amber-50',
};

type DisplayMode = 'live' | 'demo' | 'rakuten_idle';

export function AppShell() {
  const { resultCards, searchedQuery, comparedCards, searchStatus, searchWarnings, dataSourceMode, lastSearchedAt } =
    useResearchStore(
      useShallow((s) => ({
        resultCards: s.resultCards,
        searchedQuery: s.searchedQuery,
        comparedCards: s.comparedCards,
        searchStatus: s.searchStatus,
        searchWarnings: s.searchWarnings,
        dataSourceMode: s.dataSourceMode,
        lastSearchedAt: s.lastSearchedAt,
      })),
    );
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  // 検索リンクは「実際に検索した語」で作る。入力途中の文字で結果と食い違わないようにする。
  const shortcuts = buildSearchLinks(searchedQuery);
  const hasResults = resultCards.length > 0;
  const hasSearched = lastSearchedAt !== null;

  const displayMode: DisplayMode =
    searchStatus === 'official_api' || searchStatus === 'empty'
      ? 'live'
      : dataSourceMode === 'sample' || isDemoSearchStatus(searchStatus)
        ? 'demo'
        : 'rakuten_idle';

  return (
    <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8">
      {/* Sticky glass top bar: title + persistent data badge + theme selector */}
      <header className="sticky top-0 z-30 mb-6 md:mb-8">
        <div className="glass-header flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/80">
              Market Card Research
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">相場カード比較ボード</h1>
              {displayMode === 'live' && (
                <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                  実データ表示中 — 楽天市場
                </span>
              )}
              {displayMode === 'demo' && (
                <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100">
                  デモ表示中 — サンプル/見本データ
                </span>
              )}
              {displayMode === 'rakuten_idle' && (
                <span className="rounded-full border border-sky-300/40 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-100">
                  楽天市場モード — 検索すると接続します
                </span>
              )}
            </div>
          </div>
          <ThemeSelector />
        </div>
      </header>

      {/* Intro: tagline, data banner, search, steps */}
      <section className="mb-6 flex flex-col gap-4 md:mb-8">
        <p className="text-sm text-ink/70">
          商品名を入れて、まとめて探す。画像つきカードで相場を見る。
        </p>
        {displayMode === 'live' ? (
          <div className="glass border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-100">
            楽天市場の実データを表示しています。表示価格は検索時点の参考値です。最終確認は元ページで行ってください。
          </div>
        ) : displayMode === 'demo' ? (
          <div className="glass border-amber-300/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-50">
            デモ表示中 — サンプル/見本データです。検索・比較・利益計算・CSV出力の流れを確認できます。楽天市場の実データは、楽天のキーを設定した公開版でデータソース「楽天市場」を選ぶと表示されます。
          </div>
        ) : null}
        <ProductSearchBar />
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

      {/* Main layout */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Left: results */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {!hasSearched && !hasResults && (
            <div className="glass flex flex-col items-center justify-center gap-4 border-dashed px-4 py-16 text-center sm:py-20">
              <BarChart2 size={40} className="text-accent/60" aria-hidden="true" />
              <p className="text-base font-medium text-ink/80">商品名・型番・JAN・URLを入力して「まとめて探す」</p>
              <p className="text-xs text-ink/60">例: PS5 / PlayStation 5 CFI-2000A01 / JANコード / 商品URL</p>
              <button
                type="button"
                onClick={() => setShowManualAdd(true)}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs transition hover:bg-white/10"
              >
                <PlusCircle size={14} aria-hidden="true" />
                URLから手動で追加
              </button>
            </div>
          )}

          {/* Search shortcuts */}
          {shortcuts.length > 0 && <SearchShortcutCard shortcuts={shortcuts} />}

          {manualSuccess && (
            <div
              role="status"
              className="glass border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-100"
            >
              手動カードを追加しました。比較ボードと利益計算に反映されています。
            </div>
          )}

          {(hasSearched || hasResults) && (
            <div className="glass px-3.5 py-3 text-xs text-ink/70">
              <p className="mb-2 text-[11px] tracking-wide text-ink/60">カードの出どころ</p>
              <div className="flex flex-wrap gap-1.5">
                {sourceLegendItems.map((value) => (
                  <span key={value} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                    {SOURCE_TYPE_LABELS[value]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search status / fallback reason */}
          <div aria-live="polite" role="status">
            {searchWarnings.length > 0 && (
              <div
                className={`glass px-3.5 py-2.5 text-xs ${statusBannerClassByStatus[searchStatus ?? ''] ?? 'border-white/15 bg-white/5 text-ink/70'}`}
              >
                {searchWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>

          {(hasSearched || hasResults) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-ink/80">
                  検索結果 <span className="num">({resultCards.length}件)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowManualAdd(true)}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10"
                >
                  <PlusCircle size={13} aria-hidden="true" />
                  手動で追加
                </button>
              </div>
              {hasResults ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {resultCards.map((card) => (
                    <ResultCard key={card.id} card={card} />
                  ))}
                </div>
              ) : (
                <div className="glass border-dashed px-4 py-4 text-sm text-ink/70">
                  該当する候補が見つかりませんでした。検索語を変えるか、「手動で追加」から元ページのURLと価格を登録できます。
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: always visible so saved history and the compare board survive a reload */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-semibold text-ink/80">
              比較ボード <span className="num">({comparedCards.length}件)</span>
            </h2>
            <CompareBoard />
          </div>
          <ProfitPanel />
          <ExportPanel />
          <ResearchHistoryPanel />
          <AiMemoPanel />
          <ApiStatusPanel />
        </aside>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-[11px] text-ink/60">
        <span>表示価格は参考値です。購入・出品の前に必ず元ページでご確認ください。</span>
        {/* 楽天ウェブサービスの利用規約で定められたクレジット表記（HTMLは改変不可）。 */}
        <a href="https://developers.rakuten.com/" target="_blank">Supported by Rakuten Developers</a>
      </footer>

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
