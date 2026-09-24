import { useState } from 'react';
import type { MarketCard } from '../types/market';
import { useResearchStore } from '../store/researchStore';
import { ExternalLink, PlusCircle, CheckCircle } from 'lucide-react';
import { toSafeHttpUrl, toSafeHttpsUrl } from '../lib/safeUrl';
import { MAX_COMPARED_CARDS } from '../lib/persistSanitize';
import { CardSourceBadges, DEMO_ORIGIN_LABELS } from './CardSourceBadges';

type Props = {
  card: MarketCard;
};

function formatCardUrl(url: string) {
  try {
    const parsed = new URL(url);
    const display = `${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/$/, '');
    return display.length > 60 ? `${display.slice(0, 57)}...` : display;
  } catch {
    return url.length > 60 ? `${url.slice(0, 57)}...` : url;
  }
}

export function ResultCard({ card }: Props) {
  const [imageError, setImageError] = useState(false);
  const addComparedCard = useResearchStore((s) => s.addComparedCard);
  const removeComparedCard = useResearchStore((s) => s.removeComparedCard);
  const compared = useResearchStore((s) => s.comparedCards.some((c) => c.id === card.id));
  const compareFull = useResearchStore((s) => s.comparedCards.length >= MAX_COMPARED_CARDS);
  const safePageUrl = toSafeHttpUrl(card.pageUrl);
  const safeImageUrl = toSafeHttpsUrl(card.imageUrl);

  return (
    <div className="glass-card group flex flex-col overflow-hidden">
      {/* Demo-origin badge (sample / mock) */}
      {card.demoOrigin && (
        <div className="relative z-10 px-4 pt-3 pb-0">
          <span className="inline-block rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            {DEMO_ORIGIN_LABELS[card.demoOrigin]}
          </span>
        </div>
      )}

      {/* Image */}
      <div className="relative z-10 h-44 overflow-hidden bg-slate-800">
        {safeImageUrl && !imageError ? (
          <img
            src={safeImageUrl}
            alt={card.title}
            loading="lazy"
            referrerPolicy="no-referrer"
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
      <div className="relative z-10 flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-ink">{card.title}</h3>
        <p className="line-clamp-2 break-all text-[11px] leading-snug text-ink/60" title={card.pageUrl}>
          {formatCardUrl(card.pageUrl)}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <CardSourceBadges card={{ ...card, demoOrigin: undefined }} />
          {card.conditionText && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-ink/70">
              {card.conditionText}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2">
          <p className="num text-2xl font-bold tracking-tight text-accent">{card.priceText || '価格不明'}</p>
          {card.shippingText && (
            <p className="text-xs text-ink/65">{card.shippingText}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {safePageUrl ? (
            <a
              href={safePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-control border border-white/12 py-2 text-xs text-ink/80 hover:bg-white/10 transition"
            >
              <ExternalLink size={13} />
              元ページを見る
            </a>
          ) : (
            <span className="flex min-h-11 flex-1 items-center justify-center rounded-control border border-white/12 py-2 text-xs text-ink/60">
              元ページなし
            </span>
          )}
          <button
            type="button"
            onClick={() =>
              compared ? removeComparedCard(card.id) : addComparedCard(card)
            }
            aria-pressed={compared}
            disabled={!compared && compareFull}
            title={!compared && compareFull ? `比較ボードは最大${MAX_COMPARED_CARDS}件です` : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-control py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              compared
                ? 'bg-emerald-600/80 text-white hover:bg-emerald-600'
                : 'bg-accent/85 text-white hover:bg-accent'
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
