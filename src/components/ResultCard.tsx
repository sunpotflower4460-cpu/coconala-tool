import { useState } from 'react';
import type { MarketCard } from '../types/market';
import { useResearchStore } from '../store/researchStore';
import { ExternalLink, PlusCircle, CheckCircle } from 'lucide-react';

type Props = {
  card: MarketCard;
};

const sourceLabels: Record<string, string> = {
  official_api: '公式API取得',
  search_api: '検索表示から推定',
  search_link: '検索リンク',
  manual: '手動追加',
};

const SAMPLE_ID_PREFIX = 'sample-';

const confidenceColors: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  low: 'bg-slate-500/20 text-slate-300',
};

function formatCardUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function ResultCard({ card }: Props) {
  const [imageError, setImageError] = useState(false);
  const { addComparedCard, removeComparedCard, isCompared } = useResearchStore();
  const compared = isCompared(card.id);

  return (
    <div className="card-base group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-white/20 hover:bg-white/10">
      {/* Sample data badge */}
      {card.id.startsWith(SAMPLE_ID_PREFIX) && (
        <div className="px-4 pt-3 pb-0">
          <span className="inline-block rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            現在はサンプルデータです
          </span>
        </div>
      )}

      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-slate-800">
        {card.imageUrl && !imageError ? (
          <img
            src={card.imageUrl}
            alt={card.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-slate-300">
            <span className="text-xs font-semibold tracking-widest">NO IMAGE</span>
            <span className="text-[11px] text-slate-400">画像未設定</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium bg-black/60 text-white">
          {card.siteName}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug">{card.title}</h3>
        <p className="line-clamp-2 break-all text-[11px] leading-snug text-slate-500" title={card.pageUrl}>
          {formatCardUrl(card.pageUrl)}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColors[card.confidence]}`}>
            {sourceLabels[card.sourceType]}
          </span>
          {card.sourceType === 'search_link' && (
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">外部検索ページ</span>
          )}
          {card.conditionText && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
              {card.conditionText}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2">
          <p className="text-xl font-bold text-accent">{card.priceText || '価格不明'}</p>
          {card.shippingText && (
            <p className="text-xs text-slate-400">{card.shippingText}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <a
            href={card.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 py-2 text-xs hover:bg-white/10 transition"
          >
            <ExternalLink size={13} />
            元ページを見る
          </a>
          <button
            onClick={() =>
              compared ? removeComparedCard(card.id) : addComparedCard(card)
            }
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition ${
              compared
                ? 'bg-emerald-600/80 text-white hover:bg-emerald-600'
                : 'bg-accent/80 text-white hover:bg-accent'
            }`}
          >
            {compared ? <CheckCircle size={13} /> : <PlusCircle size={13} />}
            {compared ? '比較中' : '比較に追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
