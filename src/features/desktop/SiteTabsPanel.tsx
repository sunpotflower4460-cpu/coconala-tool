import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Loader2, RotateCw } from 'lucide-react';
import { getDesktop, SITE_MARKETS, type SiteMarket } from '../../lib/desktopBridge';
import { MARKET_LABELS } from '../../types/market';
import { useDesktopUi, type RightTab } from './desktopUiStore';

const PANEL_ID = 'right-tab-panel';

const OTHER_TABS: Array<{ id: RightTab; label: string }> = [
  { id: 'compare', label: '比較・利益' },
  { id: 'history', label: '保存・CSV' },
];

function isSite(tab: RightTab): tab is SiteMarket {
  return SITE_MARKETS.includes(tab as SiteMarket);
}

/**
 * 右側のタブ。メルカリ・ヤフオク・ラクマ・Amazon のタブでは、本体が実際のページを
 * 下の枠（placeholder）の位置に重ねて表示する。ダイアログ表示中は隠す。
 */
export function SiteTabsPanel({ compare, history }: { compare: ReactNode; history: ReactNode }) {
  const { rightTab, setRightTab, siteStates, overlays, setupOpen } = useDesktopUi();
  const frameRef = useRef<HTMLDivElement>(null);
  const activeSite = isSite(rightTab) ? rightTab : null;
  const hidden = overlays > 0 || setupOpen;
  const state = siteStates.find((s) => s.market === activeSite);

  // 実ページを重ねる位置を本体に伝える（大きさが変わるたびに更新）
  useLayoutEffect(() => {
    const desktop = getDesktop();
    if (!desktop) return;
    const send = () => {
      const el = frameRef.current;
      const rect = el?.getBoundingClientRect();
      desktop.sites.setLayout({
        visible: Boolean(activeSite && rect && !hidden),
        active: activeSite,
        bounds: rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
      });
    };
    send();
    const observer = new ResizeObserver(send);
    if (frameRef.current) observer.observe(frameRef.current);
    window.addEventListener('resize', send);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', send);
    };
  }, [activeSite, hidden]);

  // 画面を離れるとき（アンマウント）は実ページを隠す
  useEffect(() => () => getDesktop()?.sites.setLayout({ visible: false, active: null, bounds: null }), []);

  return (
    <section aria-label="サイトのページと比較" className="glass flex h-full min-h-0 flex-col overflow-hidden">
      <div
        role="tablist"
        aria-label="右側の表示"
        onKeyDown={(e) => {
          // ← → でタブを切り替える（一般的なタブの操作）
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const order: RightTab[] = [...SITE_MARKETS, ...OTHER_TABS.map((t) => t.id)];
          const next = order[(order.indexOf(rightTab) + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
          setRightTab(next);
          e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
        }}
        className="flex shrink-0 flex-wrap gap-1 border-b border-white/10 p-1.5">
        {SITE_MARKETS.map((market) => {
          const s = siteStates.find((x) => x.market === market);
          return (
            <button
              key={market}
              role="tab"
              type="button"
              data-tab={market}
              aria-controls={PANEL_ID}
              tabIndex={rightTab === market ? 0 : -1}
              aria-selected={rightTab === market}
              onClick={() => setRightTab(market)}
              className={`flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold transition ${
                rightTab === market ? 'bg-accent-strong text-on-accent' : 'text-ink/80 hover:bg-white/10'
              }`}
            >
              {MARKET_LABELS[market]}
              {s?.status === 'loading' && <Loader2 size={13} className="animate-spin" aria-label="読み込み中" />}
            </button>
          );
        })}
        <span className="mx-1 w-px self-stretch bg-white/10" aria-hidden="true" />
        {OTHER_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            data-tab={tab.id}
            aria-controls={PANEL_ID}
            tabIndex={rightTab === tab.id ? 0 : -1}
            aria-selected={rightTab === tab.id}
            onClick={() => setRightTab(tab.id)}
            className={`min-h-11 rounded-control px-3 text-sm font-semibold transition ${
              rightTab === tab.id ? 'bg-accent-strong text-on-accent' : 'text-ink/80 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" className="flex min-h-0 flex-1 flex-col">
      {activeSite ? (
        <>
          <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-2 py-1 text-xs text-ink/75">
            <button
              type="button"
              onClick={() => void getDesktop()?.sites.goBack(activeSite)}
              disabled={!state?.canGoBack}
              aria-label="前のページに戻る"
              className="flex h-11 w-11 items-center justify-center rounded-control hover:bg-white/10 disabled:opacity-40"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void getDesktop()?.sites.reload(activeSite)}
              disabled={state?.status === 'idle'}
              aria-label="ページを読み込み直す"
              className="flex h-11 w-11 items-center justify-center rounded-control hover:bg-white/10 disabled:opacity-40"
            >
              <RotateCw size={15} aria-hidden="true" />
            </button>
            <span className="min-w-0 flex-1 truncate px-1" title={state?.url}>
              {state?.status === 'idle'
                ? '「まとめて探す」を押すと、ここに検索結果のページが出ます'
                : state?.status === 'failed'
                  ? 'ページを開けませんでした。読み込み直すか、ブラウザで開いてください'
                  : (state?.title ?? '読み込み中…')}
            </span>
            <button
              type="button"
              onClick={() => void getDesktop()?.sites.openInBrowser(activeSite)}
              disabled={state?.status === 'idle'}
              className="flex min-h-11 items-center gap-1 rounded-control px-2 hover:bg-white/10 disabled:opacity-40"
            >
              <ExternalLink size={14} aria-hidden="true" />
              いつものブラウザで開く
            </button>
          </div>
          {/* 本体がこの枠の位置に実際のページを重ねて表示する */}
          <div ref={frameRef} data-testid="site-frame" className="relative min-h-0 flex-1 bg-white/5">
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink/60">
              {hidden ? '（ダイアログを閉じると、ここにページが戻ります）' : `${MARKET_LABELS[activeSite]}のページを表示します`}
            </p>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{rightTab === 'compare' ? compare : history}</div>
      )}
      </div>
    </section>
  );
}
