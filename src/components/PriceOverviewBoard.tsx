import { useId, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ClipboardPaste, ExternalLink, Plus, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { MARKET_LABELS, type MarketCard, type MarketId } from '../types/market';
import { toJpyPrice } from '../features/profit/profitCalculator';
import { buildSearchLinks, MANUAL_MARKETS } from '../services/searchLinkBuilder';
import { marketOf } from '../lib/marketOf';
import { parseNumberInput } from '../lib/numberInput';
import type { OutlierReason } from '../lib/priceOutliers';
import { extractPastedPrices } from '../lib/pricePaste';
import { openInSlot } from '../lib/tiledWindows';

const AUTO_MARKETS: MarketId[] = ['rakuten', 'yahoo_shopping', 'ebay'];

type Row = {
  market: MarketId;
  kind: 'auto' | 'manual';
  prices: number[];
  cards: MarketCard[];
  status?: string;
  searchUrl?: string;
};

function yen(value: number) {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ObservedPriceInput({ market, searchUrl, query }: { market: MarketId; searchUrl: string; query: string }) {
  const addObservedPrice = useResearchStore((s) => s.addObservedPrice);
  const [text, setText] = useState('');
  const inputId = useId();
  const parsed = parseNumberInput(text);
  const valid = parsed !== undefined && parsed > 0;
  const submit = () => {
    if (!valid) return;
    addObservedPrice({ market, price: parsed, pageUrl: searchUrl, query });
    setText('');
  };
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={inputId} className="sr-only">
        {MARKET_LABELS[market]}で見た価格（円）
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
        }}
        placeholder="見た価格"
        className="glass-input num h-11 w-28 px-2 text-sm text-ink placeholder:text-ink/50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        aria-label={`${MARKET_LABELS[market]}の価格を追加`}
        className="flex h-11 w-11 items-center justify-center rounded-control border border-white/15 bg-white/10 text-ink hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function PastePanel({ market, searchUrl, query, onDone }: { market: MarketId; searchUrl: string; query: string; onDone: () => void }) {
  const setPastedPrices = useResearchStore((s) => s.setPastedPrices);
  const [text, setText] = useState('');
  const textId = useId();
  const prices = extractPastedPrices(text);
  const label = MARKET_LABELS[market];
  return (
    <div className="mt-2 rounded-control border border-white/15 bg-black/20 p-3">
      <label htmlFor={textId} className="text-xs font-semibold text-ink">
        {label}の検索ページで「すべて選択」→「コピー」して、ここに貼り付けてください
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Ctrl+A（MacはCmd+A）→ Ctrl+C でコピーして、ここで Ctrl+V"
        className="glass-input mt-1.5 w-full px-2 py-1.5 text-xs text-ink placeholder:text-ink/50"
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="num text-xs text-ink/80" aria-live="polite">
          {text
            ? prices.length
              ? `価格が ${prices.length} 件見つかりました（${yen(Math.min(...prices))} 〜 ${yen(Math.max(...prices))}）`
              : '価格が見つかりませんでした。検索結果のページ全体をコピーしてください。'
            : 'クーポン・ポイント・送料の金額は自動で除きます。'}
        </p>
        <div className="flex gap-1.5">
          <button type="button" onClick={onDone} className="min-h-11 rounded-control border border-white/15 px-3 text-xs text-ink/85 hover:bg-white/10">
            閉じる
          </button>
          <button
            type="button"
            disabled={prices.length === 0}
            onClick={() => {
              setPastedPrices({ market, prices, pageUrl: searchUrl, query });
              onDone();
            }}
            className="min-h-11 rounded-control bg-accent-strong px-3 text-xs font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {prices.length ? `${prices.length}件を取り込む` : '取り込む'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 相場一覧: サイトごとの価格帯を同じ目盛りの横棒で並べ、どこが安いかを一目で比べる。
 *  - 楽天・Yahoo!ショッピング・eBay は検索結果から自動で集計（eBay はドル円レートで円換算）
 *  - メルカリ・ヤフオク・ラクマ・Amazon は自動取得しない。検索ページを開いて見た価格を入力すると同じ棒に並ぶ
 */
type BoardProps = {
  outliers: Map<string, OutlierReason>;
  includeOutliers: boolean;
  onToggleOutliers: () => void;
  /** デスクトップ版: 「開く」で右のタブを切り替え、サイト名でそのサイトの商品に絞り込む（貼り付けは「取り込む」ボタンに置き換え） */
  desktop?: { onOpenSite: (market: MarketId) => void; onShowMarket: (market: MarketId) => void };
};

export function PriceOverviewBoard({ outliers, includeOutliers, onToggleOutliers, desktop }: BoardProps) {
  const [pasteFor, setPasteFor] = useState<MarketId | null>(null);
  const [blockedWindow, setBlockedWindow] = useState(false);
  const { resultCards, pastedCards, clearPastedPrices, searchSources, searchedQuery, exchangeRate, dataSourceMode, removeResultCard } = useResearchStore(
    useShallow((s) => ({
      resultCards: s.resultCards,
      pastedCards: s.pastedCards,
      clearPastedPrices: s.clearPastedPrices,
      searchSources: s.searchSources,
      searchedQuery: s.searchedQuery,
      exchangeRate: s.profitSettings.exchangeRate,
      dataSourceMode: s.dataSourceMode,
      removeResultCard: s.removeResultCard,
    })),
  );
  if (!searchedQuery) return null;

  const links = buildSearchLinks(searchedQuery);
  const byMarket = new Map<MarketId, MarketCard[]>();
  for (const card of [...resultCards, ...pastedCards]) {
    const market = marketOf(card);
    byMarket.set(market, [...(byMarket.get(market) ?? []), card]);
  }
  const toRow = (market: MarketId, kind: Row['kind']): Row => {
    const cards = byMarket.get(market) ?? [];
    const prices = cards
      .filter((c) => includeOutliers || !outliers.has(c.id))
      .map((c) => toJpyPrice(c, exchangeRate))
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const source = searchSources.find((s) => s.market === market);
    const shortcutId = MANUAL_MARKETS.find((m) => m.market === market)?.shortcutId;
    return {
      market,
      kind,
      prices,
      cards,
      status: source && source.outcome !== 'ok' ? source.message : undefined,
      searchUrl: links.find((l) => l.id === shortcutId)?.url,
    };
  };

  const autoRows = AUTO_MARKETS.filter((m) => dataSourceMode === 'multi' || byMarket.has(m)).map((m) => toRow(m, 'auto'));
  const manualRows = MANUAL_MARKETS.map(({ market }) => toRow(market, 'manual'));
  const otherRow = byMarket.has('other') ? [toRow('other', 'auto')] : [];
  const rows = [...autoRows, ...manualRows, ...otherRow];

  const all = rows.flatMap((r) => r.prices);
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 0;
  const span = hi - lo || 1;
  const cheapest = rows.filter((r) => r.prices.length).sort((a, b) => Math.min(...a.prices) - Math.min(...b.prices))[0]?.market;
  const pos = (value: number) => ((value - lo) / span) * 100;

  return (
    <section className="glass p-4" aria-labelledby="price-overview-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="price-overview-title" className="font-display text-sm font-semibold text-ink">
            相場一覧（サイト別の価格帯）
          </h2>
          <p className="mt-0.5 text-xs text-ink/70">
            {desktop
              ? 'サイトごとの値段の幅を同じ目盛りで並べています。サイト名を押すと、そのサイトの商品だけを下の一覧に出します。メルカリ・ヤフオク・ラクマ・Amazon は「値段を取り込む」を押すと入ります。'
              : '同じ目盛りで並べています。メルカリ・ヤフオク・ラクマ・Amazon は「開く」で右側に表示し、ページをコピーして貼り付けボタンで取り込むか、見た価格を入力すると並びます（自動取得はしません）。'}
          </p>
        </div>
        {all.length > 0 && (
          <p className="num text-xs text-ink/70">
            全体 {yen(lo)} 〜 {yen(hi)}
          </p>
        )}
      </div>
      {outliers.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-50">
          <span>
            {includeOutliers
              ? `相場から大きく外れた ${outliers.size} 件（付属品・まとめ売り等の可能性）も含めています。`
              : `相場から大きく外れた ${outliers.size} 件（付属品・まとめ売り等の可能性）を価格帯から除いています。`}
          </span>
          <button
            type="button"
            onClick={onToggleOutliers}
            aria-pressed={includeOutliers}
            className="min-h-11 rounded-control border border-amber-200/40 px-3 font-semibold hover:bg-amber-500/20"
          >
            {includeOutliers ? '除いて表示する' : '含めて表示する'}
          </button>
        </div>
      )}

      <ul aria-label="サイト別の価格帯" className="flex flex-col divide-y divide-white/10">
        {rows.map((row) => {
          const min = row.prices.length ? Math.min(...row.prices) : undefined;
          const max = row.prices.length ? Math.max(...row.prices) : undefined;
          const mid = row.prices.length ? median(row.prices) : undefined;
          const observed = row.kind === 'manual' ? row.cards.filter((c) => c.id.startsWith('observed-')) : [];
          const pasted = row.kind === 'manual' ? row.cards.filter((c) => c.id.startsWith('pasted-')) : [];
          const slot = MANUAL_MARKETS.findIndex((m) => m.market === row.market);
          return (
            <li key={row.market} className="grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_18.5rem] sm:items-center">
              <div className="flex flex-wrap items-center gap-1.5">
                {desktop && row.cards.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => desktop.onShowMarket(row.market)}
                    className="min-h-11 rounded-control text-left text-sm font-semibold text-ink underline decoration-dotted underline-offset-4 hover:text-accent-text"
                  >
                    {MARKET_LABELS[row.market]}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-ink">{MARKET_LABELS[row.market]}</span>
                )}
                {row.market === cheapest && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">最安</span>
                )}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-ink/75">
                  {row.kind === 'auto'
                    ? '自動取得'
                    : desktop
                      ? row.cards.some((c) => c.id.startsWith('captured-'))
                        ? '取り込み'
                        : row.cards.length > 0
                          ? '手入力'
                          : '未取り込み'
                      : '手入力'}
                </span>
              </div>

              <div className="min-w-0">
                {min !== undefined && max !== undefined && mid !== undefined ? (
                  <>
                    <div className="relative h-2.5 rounded-full bg-white/10" aria-hidden="true">
                      <div
                        className="absolute top-0 h-2.5 rounded-full bg-accent-strong/80"
                        style={{ left: `${pos(min)}%`, width: `${Math.max(pos(max) - pos(min), 1.5)}%` }}
                      />
                      <div
                        className="absolute -top-0.5 h-3.5 w-1 rounded-full bg-white"
                        style={{ left: `calc(${pos(mid)}% - 2px)` }}
                      />
                    </div>
                    <p className="num mt-1 text-xs text-ink/85">
                      {min === max ? yen(min) : `${yen(min)} 〜 ${yen(max)}`}
                      <span className="text-ink/65">（{row.prices.length}件{row.prices.length > 1 ? `・中央 ${yen(mid)}` : ''}）</span>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-ink/65">
                    {row.status ??
                      (row.kind === 'manual'
                        ? desktop
                          ? '「値段を取り込む」を押すと並びます'
                          : '「開く」で検索ページを見て、価格を入力してください'
                        : '該当なし')}
                  </p>
                )}
                {pasted.length > 0 && (
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-ink/80">
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-sky-100">検索表示から推定</span>
                    貼り付けた {pasted.length} 件
                    <button
                      type="button"
                      onClick={() => clearPastedPrices(row.market)}
                      aria-label={`${MARKET_LABELS[row.market]}の貼り付けた価格をすべて削除`}
                      className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </p>
                )}
                {observed.length > 0 && (
                  <ul aria-label={`${MARKET_LABELS[row.market]}で入力した価格`} className="mt-1 flex flex-wrap gap-1">
                    {observed.map((card) => (
                      <li key={card.id} className="flex items-center gap-0.5 rounded-full bg-white/10 pl-2 text-[11px] text-ink/85">
                        <span className="num">{card.priceText}</span>
                        <button
                          type="button"
                          onClick={() => removeResultCard(card.id)}
                          aria-label={`${MARKET_LABELS[row.market]}の ${card.priceText} を削除`}
                          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {row.kind === 'manual' && row.searchUrl && desktop ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => desktop.onOpenSite(row.market)}
                    aria-label={`${MARKET_LABELS[row.market]}のページを右のタブで見る`}
                    className="flex h-11 items-center gap-1 rounded-control border border-white/15 px-3 text-xs text-ink/90 hover:bg-white/10"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    右で見る
                  </button>
                  <ObservedPriceInput market={row.market} searchUrl={row.searchUrl} query={searchedQuery} />
                </div>
              ) : row.kind === 'manual' && row.searchUrl ? (
                <div className="flex items-center gap-1.5">
                  <a
                    href={row.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      // ツールの右側、「まとめて開く」と同じ位置のウィンドウで開く（ブロックされたら通常のタブで開く）
                      const opened = openInSlot({ id: `${row.market}`, url: row.searchUrl as string }, Math.max(slot, 0), MANUAL_MARKETS.length);
                      if (opened) e.preventDefault();
                      setBlockedWindow(!opened);
                    }}
                    className="flex h-11 items-center gap-1 rounded-control border border-white/15 px-3 text-xs text-ink/90 hover:bg-white/10"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    開く
                  </a>
                  <button
                    type="button"
                    onClick={() => setPasteFor(pasteFor === row.market ? null : row.market)}
                    aria-expanded={pasteFor === row.market}
                    aria-label={`${MARKET_LABELS[row.market]}の検索ページを貼り付けて価格を取り込む`}
                    className="flex h-11 w-11 items-center justify-center rounded-control border border-white/15 text-ink/90 hover:bg-white/10"
                  >
                    <ClipboardPaste size={15} aria-hidden="true" />
                  </button>
                  <ObservedPriceInput market={row.market} searchUrl={row.searchUrl} query={searchedQuery} />
                </div>
              ) : (
                <span />
              )}
              {pasteFor === row.market && row.searchUrl && (
                <div className="sm:col-span-3">
                  <PastePanel market={row.market} searchUrl={row.searchUrl} query={searchedQuery} onDone={() => setPasteFor(null)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {blockedWindow && (
        <p role="alert" className="mt-2 text-xs text-amber-100">
          ブラウザがウィンドウをブロックしたため、新しいタブで開きました。右側に並べて開くには、アドレスバー右端のアイコンからポップアップを許可してください。
        </p>
      )}
    </section>
  );
}
