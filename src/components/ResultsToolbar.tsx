import { MARKET_LABELS, type MarketCard, type MarketId, type SourceResult } from '../types/market';
import { marketOf } from '../lib/marketOf';
import { toJpyPrice } from '../features/profit/profitCalculator';

export type ResultSort = 'default' | 'price_asc' | 'price_desc';
export type ResultFilter = 'all' | MarketId;

/** 絞り込み・並べ替えを適用する。価格の無いカードは並べ替え時に末尾へ。 */
export function applyResultView(cards: MarketCard[], filter: ResultFilter, sort: ResultSort, exchangeRate: number): MarketCard[] {
  const filtered = filter === 'all' ? cards : cards.filter((card) => marketOf(card) === filter);
  if (sort === 'default') return filtered;
  const price = (card: MarketCard) => toJpyPrice(card, exchangeRate);
  return [...filtered].sort((a, b) => {
    const pa = price(a);
    const pb = price(b);
    if (pa === undefined && pb === undefined) return 0;
    if (pa === undefined) return 1;
    if (pb === undefined) return -1;
    return sort === 'price_asc' ? pa - pb : pb - pa;
  });
}

type Props = {
  cards: MarketCard[];
  sources: SourceResult[];
  filter: ResultFilter;
  sort: ResultSort;
  onFilter: (filter: ResultFilter) => void;
  onSort: (sort: ResultSort) => void;
};

/** サイトごとの件数（と失敗理由）を並べ、押すとそのサイトだけに絞り込む。並べ替えは円換算の価格で行う。 */
export function ResultsToolbar({ cards, sources, filter, sort, onFilter, onSort }: Props) {
  const counts = new Map<MarketId, number>();
  for (const card of cards) counts.set(marketOf(card), (counts.get(marketOf(card)) ?? 0) + 1);
  const markets = [...new Set<MarketId>([...sources.map((s) => s.market), ...counts.keys()])];
  if (markets.length === 0) return null;

  const chip = (value: ResultFilter, label: string, extra?: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={filter === value}
      onClick={() => onFilter(value)}
      className={`flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs transition ${
        filter === value ? 'border-accent/70 bg-accent/20 font-semibold text-ink' : 'border-white/15 bg-white/5 text-ink/80 hover:bg-white/10'
      }`}
    >
      {label}
      {extra && <span className="text-ink/65">{extra}</span>}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="サイトで絞り込む" className="flex flex-wrap gap-1.5">
        {chip('all', 'すべて', `${cards.length}件`)}
        {markets.map((market) => {
          const source = sources.find((s) => s.market === market);
          const count = counts.get(market) ?? 0;
          const extra = count > 0 ? `${count}件` : source?.outcome === 'failed' ? '未表示' : '0件';
          return chip(market, MARKET_LABELS[market], extra);
        })}
      </div>
      <label className="flex items-center gap-2 text-xs text-ink/80">
        並べ替え
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as ResultSort)}
          className="glass-input h-11 bg-black/30 px-2 text-xs text-ink"
        >
          <option value="default">おすすめ順</option>
          <option value="price_asc">安い順（円換算）</option>
          <option value="price_desc">高い順（円換算）</option>
        </select>
      </label>
    </div>
  );
}
