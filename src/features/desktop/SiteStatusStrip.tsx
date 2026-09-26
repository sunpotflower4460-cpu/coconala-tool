import { AlertTriangle, CheckCircle2, Download, Loader2, PanelRight, Settings } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useResearchStore } from '../../store/researchStore';
import { MARKET_LABELS, type MarketId, type OfficialMarketId } from '../../types/market';
import { SITE_MARKETS, type KeySite } from '../../lib/desktopBridge';
import { useDesktopUi } from './desktopUiStore';
import { captureVisiblePrices } from './captureAction';

const KEY_SITE: Record<OfficialMarketId, KeySite> = { rakuten: 'rakuten', yahoo_shopping: 'yahoo', ebay: 'ebay' };
const AUTO: OfficialMarketId[] = ['rakuten', 'yahoo_shopping', 'ebay'];

const chip = 'flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-left text-sm transition';

/**
 * 検索直後に「どのサイトの結果が、どこに出ているか」を1行で示す。
 * 押すと、そのサイトの結果に絞り込む・右のタブを開く・キーの設定を開く。
 */
export function SiteStatusStrip({ onShowMarket }: { onShowMarket: (market: MarketId) => void }) {
  const { sources, resultCards, lastSearchedAt, isSearching } = useResearchStore(
    useShallow((s) => ({ sources: s.searchSources, resultCards: s.resultCards, lastSearchedAt: s.lastSearchedAt, isSearching: s.isSearching })),
  );
  const { siteStates, setRightTab, openSetup, capturing } = useDesktopUi(
    useShallow((s) => ({ siteStates: s.siteStates, setRightTab: s.setRightTab, openSetup: s.openSetup, capturing: s.capturing })),
  );
  if (!lastSearchedAt) return null;

  const anySiteReady = siteStates.some((s) => s.status === 'ready');

  return (
    <section aria-label="サイトごとの状況" className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {AUTO.map((market) => {
          const source = sources.find((s) => s.market === market);
          const label = MARKET_LABELS[market];
          if (!source) return null;
          if (source.outcome === 'ok') {
            return (
              <li key={market}>
                <button type="button" onClick={() => onShowMarket(market)} className={`${chip} border-emerald-300/40 bg-emerald-500/10 text-ink`}>
                  <CheckCircle2 size={16} className="text-emerald-300" aria-hidden="true" />
                  <span className="font-semibold">{label}</span>
                  <span className="num">{source.count}件</span>
                  <span className="text-xs text-ink/70">画像つき・下の一覧</span>
                </button>
              </li>
            );
          }
          if (source.outcome === 'failed' && (source.failure === 'mock_no_key' || source.failure === 'mock_setup_error')) {
            return (
              <li key={market}>
                <button
                  type="button"
                  onClick={() => openSetup(KEY_SITE[market])}
                  className={`${chip} border-amber-300/50 bg-amber-500/10 text-ink`}
                >
                  <Settings size={16} className="text-amber-200" aria-hidden="true" />
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs">
                    {source.failure === 'mock_no_key' ? 'キーが未設定です → 押して設定する' : 'キーの確認が必要です → 押して確認する'}
                  </span>
                </button>
              </li>
            );
          }
          return (
            <li key={market} className={`${chip} border-white/15 bg-white/5 text-ink/80`}>
              {source.outcome === 'failed' && <AlertTriangle size={16} className="text-amber-200" aria-hidden="true" />}
              <span className="font-semibold">{label}</span>
              <span className="text-xs">{source.outcome === 'empty' ? '見つかりませんでした' : source.message}</span>
            </li>
          );
        })}
        {SITE_MARKETS.map((market) => {
          const state = siteStates.find((s) => s.market === market);
          const captured = resultCards.filter((c) => c.market === market && c.id.startsWith('captured-')).length;
          return (
            <li key={market}>
              <button type="button" onClick={() => setRightTab(market)} className={`${chip} border-sky-300/40 bg-sky-500/10 text-ink`}>
                {state?.status === 'loading' ? (
                  <Loader2 size={16} className="animate-spin text-sky-200" aria-hidden="true" />
                ) : (
                  <PanelRight size={16} className="text-sky-200" aria-hidden="true" />
                )}
                <span className="font-semibold">{MARKET_LABELS[market]}</span>
                <span className="text-xs text-ink/75">
                  {state?.status === 'loading'
                    ? '開いています…'
                    : state?.status === 'failed'
                      ? '開けませんでした'
                      : captured > 0
                        ? `取り込み ${captured}件・右のタブ`
                        : '右のタブに表示中'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void captureVisiblePrices()}
          disabled={!anySiteReady || capturing || isSearching}
          className="flex min-h-12 items-center gap-2 rounded-card bg-accent-strong px-5 text-sm font-bold text-on-accent shadow-glass-2 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {capturing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
          {capturing ? '取り込み中…' : 'メルカリ・ヤフオク・ラクマ・Amazon の値段を取り込む'}
        </button>
        <span className="text-xs text-ink/70">
          右のタブに出ている検索結果（各サイト1ページ）から、値段と商品ページへのリンクだけを一覧に加えます。画像は取り込みません。
        </span>
      </div>
    </section>
  );
}
