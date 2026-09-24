import { SOURCE_TYPE_LABELS, type MarketCard } from '../types/market';

export const DEMO_ORIGIN_LABELS = {
  sample: 'サンプルデータ',
  mock: '見本データ（実在しない商品）',
} as const;

const confidenceColors: Record<MarketCard['confidence'], string> = {
  high: 'bg-emerald-500/20 text-emerald-200',
  medium: 'bg-yellow-500/20 text-yellow-200',
  low: 'bg-slate-500/25 text-slate-200',
};

/**
 * カードの出どころ（公式API取得 / 検索表示から推定 / 検索リンク / 手動追加）と、
 * サンプル・見本データかどうかを必ず並べて表示する。比較ボードでも同じ表示を使う。
 */
export function CardSourceBadges({ card, compact = false }: { card: MarketCard; compact?: boolean }) {
  const size = compact ? 'text-[11px]' : 'text-xs';
  return (
    <div className="flex flex-wrap gap-1.5">
      {card.demoOrigin && (
        <span className={`rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-100 ${size}`}>
          {DEMO_ORIGIN_LABELS[card.demoOrigin]}
        </span>
      )}
      <span className={`rounded-full px-2 py-0.5 font-medium ${confidenceColors[card.confidence]} ${size}`}>
        {SOURCE_TYPE_LABELS[card.sourceType]}
      </span>
      {card.sourceType === 'search_link' && (
        <span className={`rounded-full bg-sky-500/20 px-2 py-0.5 text-sky-200 ${size}`}>外部検索ページ</span>
      )}
    </div>
  );
}
