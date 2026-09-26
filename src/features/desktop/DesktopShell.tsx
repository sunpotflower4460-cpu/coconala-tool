import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BarChart2, CalendarClock, PlusCircle, Settings } from 'lucide-react';
import { useResearchStore } from '../../store/researchStore';
import { performSearch } from '../search/performSearch';
import { ProductSearchBar } from '../../components/ProductSearchBar';
import { ResultCard } from '../../components/ResultCard';
import { CompareBoard } from '../../components/CompareBoard';
import { ProfitPanel } from '../../components/ProfitPanel';
import { ExportPanel } from '../../components/ExportPanel';
import { ResearchHistoryPanel } from '../../components/ResearchHistoryPanel';
import { AiMemoPanel } from '../../components/AiMemoPanel';
import { ThemeSelector } from '../../components/ThemeSelector';
import { PriceOverviewBoard } from '../../components/PriceOverviewBoard';
import { ResultsToolbar, applyResultView, type ResultFilter, type ResultSort } from '../../components/ResultsToolbar';
import { ManualAddPanel } from '../manualAdd/ManualAddPanel';
import { findPriceOutliers } from '../../lib/priceOutliers';
import { getDesktop, SITE_MARKETS, type SiteMarket } from '../../lib/desktopBridge';
import { REGISTRATION_URLS } from '../../lib/desktopConfig';
import { MARKET_LABELS, type MarketId } from '../../types/market';
import { useDesktopUi } from './desktopUiStore';
import { SiteTabsPanel } from './SiteTabsPanel';
import { SiteStatusStrip } from './SiteStatusStrip';
import { SetupWizard } from './SetupWizard';

const SETUP_SEEN_KEY = 'desktop-setup-seen';
const EXAMPLE_QUERY = 'Nintendo Switch 2';

function daysUntil(date: string): number {
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

/** 検索結果の要約（どこに何件あるか）を、色に頼らず文で伝える。 */
function summarize(counts: Map<MarketId, number>, capturedTotal: number): string {
  const auto = (['rakuten', 'yahoo_shopping', 'ebay'] as MarketId[]).filter((m) => (counts.get(m) ?? 0) > 0);
  const autoTotal = auto.reduce((sum, m) => sum + (counts.get(m) ?? 0), 0);
  const parts: string[] = [];
  if (autoTotal > 0) parts.push(`${auto.map((m) => MARKET_LABELS[m]).join('・')} から ${autoTotal}件（画像つき）`);
  if (capturedTotal > 0) parts.push(`取り込んだ値段 ${capturedTotal}件`);
  const head = parts.length ? `${parts.join('、')}を安い順に並べました。` : '画像つきで表示できる商品はまだありません。';
  const tail =
    capturedTotal > 0
      ? '値段は検索時点の参考です。「元ページを見る」で確かめてください。'
      : 'メルカリ・ヤフオク・ラクマ・Amazon は右のタブに表示中です。上の「値段を取り込む」を押すと、この一覧に加わります。';
  return `${head}${tail}`;
}

export function DesktopShell() {
  const { resultCards, lastSearchedAt, searchSources, exchangeRate, comparedCount, setDataSourceMode, dataSourceMode } = useResearchStore(
    useShallow((s) => ({
      resultCards: s.resultCards,
      lastSearchedAt: s.lastSearchedAt,
      searchSources: s.searchSources,
      exchangeRate: s.profitSettings.exchangeRate,
      comparedCount: s.comparedCards.length,
      setDataSourceMode: s.setDataSourceMode,
      dataSourceMode: s.dataSourceMode,
    })),
  );
  const { keyStatus, setKeyStatus, openSetup, setSiteStates, setRightTab, pushOverlay, popOverlay, captureNotice } = useDesktopUi(
    useShallow((s) => ({
      keyStatus: s.keyStatus,
      setKeyStatus: s.setKeyStatus,
      openSetup: s.openSetup,
      setSiteStates: s.setSiteStates,
      setRightTab: s.setRightTab,
      pushOverlay: s.pushOverlay,
      popOverlay: s.popOverlay,
      captureNotice: s.captureNotice,
    })),
  );
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [sort, setSort] = useState<ResultSort>('price_asc');
  const [includeOutliers, setIncludeOutliers] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

  // デスクトップ版は常に「まとめて」（データソースの選択は出さない）
  useEffect(() => {
    if (dataSourceMode !== 'multi') setDataSourceMode('multi');
  }, [dataSourceMode, setDataSourceMode]);

  // 本体からキーの状態・右のタブの状態を受け取る。初回起動でキーが1つも無ければ設定を開く
  useEffect(() => {
    const desktop = getDesktop();
    if (!desktop) return;
    void desktop.keys.status().then((status) => {
      setKeyStatus(status);
      let seen = false;
      try {
        seen = localStorage.getItem(SETUP_SEEN_KEY) === '1';
        localStorage.setItem(SETUP_SEEN_KEY, '1');
      } catch {
        // 保存できない環境では毎回は開かない
        seen = true;
      }
      const none = !status.rakuten.configured && !status.yahoo.configured && !status.ebay.configured;
      if (!seen && none) openSetup('overview');
    });
    return desktop.sites.onState(setSiteStates);
  }, [setKeyStatus, openSetup, setSiteStates]);

  // 新しく検索したら、絞り込みと前回の取り込みのお知らせを戻す
  useEffect(() => {
    setFilter('all');
    useDesktopUi.getState().setCaptureNotice(null);
  }, [lastSearchedAt]);

  useEffect(() => {
    if (!showManualAdd) return;
    pushOverlay();
    return () => popOverlay();
  }, [showManualAdd, pushOverlay, popOverlay]);

  const outliers = useMemo(() => findPriceOutliers(resultCards, exchangeRate), [resultCards, exchangeRate]);
  const visibleCards = applyResultView(resultCards, filter, sort, exchangeRate);
  const counts = new Map<MarketId, number>();
  for (const c of resultCards) if (c.market) counts.set(c.market, (counts.get(c.market) ?? 0) + 1);
  const capturedTotal = resultCards.filter((c) => c.id.startsWith('captured-')).length;
  const hasSearched = lastSearchedAt !== null;

  const showMarket = (market: MarketId) => {
    setFilter(market as ResultFilter);
    document.getElementById('desktop-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openSite = (market: MarketId) => {
    if (SITE_MARKETS.includes(market as SiteMarket)) setRightTab(market as SiteMarket);
  };

  const expiresOn = keyStatus?.rakuten.configured ? keyStatus.rakuten.expiresOn : undefined;
  const expiryDays = expiresOn ? daysUntil(expiresOn) : null;

  return (
    <div className="flex h-dvh flex-col gap-3 px-4 py-3">
      <header className="glass-header flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">相場カード比較ボード</h1>
          <span className="text-xs text-ink/70">商品名を入れて「まとめて探す」を押すだけ</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSetup('overview')}
            className="flex min-h-11 items-center gap-1.5 rounded-control border border-white/20 px-3 text-sm font-semibold hover:bg-white/10"
          >
            <Settings size={16} aria-hidden="true" />
            設定（キーの登録）
          </button>
          <ThemeSelector />
        </div>
      </header>

      {expiryDays !== null && expiryDays <= 30 && (
        <div role="alert" className="glass flex shrink-0 flex-wrap items-center gap-2 border-amber-300/40 bg-amber-500/10 px-4 py-2 text-sm">
          <CalendarClock size={16} aria-hidden="true" />
          {expiryDays < 0
            ? `楽天のアプリの有効期限（${expiresOn}）が過ぎています。楽天のアプリ一覧で延長してください。`
            : `楽天のアプリの有効期限（${expiresOn}）まであと ${expiryDays} 日です。楽天のアプリ一覧で延長してください。`}
          <button type="button" onClick={() => void getDesktop()?.openExternal(REGISTRATION_URLS.rakutenList)} className="min-h-11 rounded-control border border-white/20 px-3 font-semibold hover:bg-white/10">
            楽天のアプリ一覧を開く
          </button>
        </div>
      )}

      <div className="shrink-0">
        <ProductSearchBar hideSourceSelector />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左: 結果（この列だけスクロールする） */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {!hasSearched ? (
            <div className="glass flex flex-col items-center justify-center gap-4 border-dashed px-4 py-14 text-center">
              <BarChart2 size={40} className="text-accent/60" aria-hidden="true" />
              <p className="text-base font-medium text-ink/85">上の欄に商品名・型番・JANコードを入れて「まとめて探す」を押してください</p>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-left text-sm text-ink/75">
                <li>楽天市場・Yahoo!ショッピング・eBay の商品が、画像つきでこの下に並びます</li>
                <li>メルカリ・ヤフオク・ラクマ・Amazon の検索結果が、右のタブに開きます</li>
                <li>「値段を取り込む」を押すと、メルカリ等の値段もこの一覧に加わります</li>
              </ol>
              <button
                type="button"
                onClick={() => {
                  useResearchStore.getState().setQuery(EXAMPLE_QUERY);
                  void performSearch();
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent-strong px-5 text-sm font-semibold text-on-accent hover:brightness-110"
              >
                {EXAMPLE_QUERY} で試してみる
              </button>
            </div>
          ) : (
            <>
              <SiteStatusStrip onShowMarket={showMarket} />
              <div aria-live="polite">
                {captureNotice && (
                  <div
                    role="status"
                    className={`glass px-4 py-2.5 text-sm ${captureNotice.kind === 'ok' ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-amber-300/40 bg-amber-500/10'}`}
                  >
                    <p className="font-semibold">
                      {captureNotice.kind === 'ok' ? '値段を取り込みました' : '値段の取り込み結果（一部のサイトは読み取れませんでした）'}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {captureNotice.lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="glass px-4 py-3 text-sm leading-relaxed text-ink/90" data-testid="result-summary">
                {summarize(counts, capturedTotal)}
              </p>
              <PriceOverviewBoard
                outliers={outliers}
                includeOutliers={includeOutliers}
                onToggleOutliers={() => setIncludeOutliers((v) => !v)}
                desktop={{ onOpenSite: openSite, onShowMarket: showMarket }}
              />
              <section id="desktop-results" className="flex flex-col gap-3" aria-labelledby="desktop-results-title">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="desktop-results-title" className="font-display text-base font-semibold text-ink">
                    商品の一覧 <span className="num">({resultCards.length}件)</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowManualAdd(true)}
                    className="flex min-h-11 items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 text-xs transition hover:bg-white/10"
                  >
                    <PlusCircle size={13} aria-hidden="true" />
                    URLから手動で追加
                  </button>
                </div>
                {(resultCards.length > 0 || searchSources.length > 0) && (
                  <ResultsToolbar cards={resultCards} sources={searchSources} filter={filter} sort={sort} onFilter={setFilter} onSort={setSort} />
                )}
                {visibleCards.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleCards.map((card) => (
                      <ResultCard key={card.id} card={card} outlier={outliers.get(card.id)} />
                    ))}
                  </div>
                ) : (
                  <div className="glass border-dashed px-4 py-4 text-sm text-ink/70">
                    {resultCards.length > 0
                      ? 'このサイトの商品はありません。「すべて」で他のサイトの商品を表示できます。'
                      : '一覧に出せる商品はまだありません。右のタブで値段を見るか、「値段を取り込む」を押してください。'}
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-ink/60">
            <span>表示価格は参考値です。購入・出品の前に必ず元ページでご確認ください。</span>
            {/* 楽天ウェブサービスの利用規約で定められたクレジット表記（HTMLは改変不可）。 */}
            <span className="flex flex-wrap items-center gap-3">
              <a href="https://developers.rakuten.com/" target="_blank">Supported by Rakuten Developers</a>
              {/* Yahoo! JAPAN Web API のクレジット表記（必須・改変不可）。 */}
              {/* Begin Yahoo! JAPAN Web Services Attribution Snippet */}
              <span style={{ margin: '15px 15px 15px 15px' }}><a href="https://developer.yahoo.co.jp/sitemap/">Webサービス by Yahoo! JAPAN</a></span>
              {/* End Yahoo! JAPAN Web Services Attribution Snippet */}
            </span>
          </footer>
        </div>

        {/* 右: 実際のページのタブ・比較・保存（この列は動かない） */}
        <div className="flex w-[46%] min-w-[440px] max-w-[900px] flex-col">
          <SiteTabsPanel
            compare={
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-sm font-semibold text-ink/80">
                  比較ボード <span className="num">({comparedCount}件)</span>
                </h2>
                <CompareBoard />
                <ProfitPanel />
                <AiMemoPanel />
              </div>
            }
            history={
              <div className="flex flex-col gap-4">
                <ResearchHistoryPanel />
                <ExportPanel />
              </div>
            }
          />
        </div>
      </div>

      <SetupWizard />
      {showManualAdd && <ManualAddPanel onClose={() => setShowManualAdd(false)} onSuccess={() => undefined} />}
    </div>
  );
}
