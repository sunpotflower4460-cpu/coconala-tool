import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { MarketCard } from '../types/market';
import { toJpyPrice } from '../features/profit/profitCalculator';
import { toSafeHttpUrl, toSafeHttpsUrl } from '../lib/safeUrl';
import { MAX_COMPARED_CARDS } from '../lib/persistSanitize';
import { CardSourceBadges } from './CardSourceBadges';

function CompareCardItem({ card }: { card: MarketCard }) {
  const [imageError, setImageError] = useState(false);
  const removeComparedCard = useResearchStore((s) => s.removeComparedCard);
  const applyPriceFromCard = useResearchStore((s) => s.applyPriceFromCard);
  const exchangeRate = useResearchStore((s) => s.profitSettings.exchangeRate);
  const normalizedPrice = toJpyPrice(card, exchangeRate);
  const hasPrice = typeof normalizedPrice === 'number';
  const priceSourceLabel = `${card.siteName}${card.priceText ? ` ${card.priceText}` : ''}`;
  const safePageUrl = toSafeHttpUrl(card.pageUrl);
  const safeImageUrl = toSafeHttpsUrl(card.imageUrl);
  const handleUseAsBuy = () => {
    if (normalizedPrice === undefined) return;
    applyPriceFromCard('buyPrice', normalizedPrice, priceSourceLabel);
  };
  const handleUseAsSell = () => {
    if (normalizedPrice === undefined) return;
    applyPriceFromCard('sellPrice', normalizedPrice, priceSourceLabel);
  };

  return (
    <div className="glass-card flex items-center gap-3 p-3">
      {safeImageUrl && !imageError ? (
        <img
          src={safeImageUrl}
          alt={card.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-12 w-16 shrink-0 rounded-lg object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-[10px] text-slate-300">
          NO IMAGE
        </div>
      )}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="line-clamp-2 break-words text-xs font-medium text-ink">{card.title}</p>
        <p className="num text-lg font-bold text-accent">{card.priceText || '価格不明'}</p>
        <div className="mt-1">
          <CardSourceBadges card={card} compact />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink/65">
          <span>{card.siteName}</span>
          {card.currency === 'USD' && hasPrice && (
            <span className="num rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-200">
              {normalizedPrice.toLocaleString()}円換算
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={handleUseAsBuy}
            disabled={!hasPrice}
            className="min-h-11 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-medium text-ink/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            この価格を仕入れに使う
          </button>
          <button
            onClick={handleUseAsSell}
            disabled={!hasPrice}
            className="min-h-11 rounded-full bg-accent/85 px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            この価格を販売に使う
          </button>
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-end gap-1 shrink-0">
        <button
          onClick={() => removeComparedCard(card.id)}
          aria-label="比較から削除"
          className="flex h-11 w-11 items-center justify-center rounded-control text-ink/55 hover:bg-white/10 hover:text-red-400 transition"
        >
          <X size={16} aria-hidden="true" />
        </button>
        {safePageUrl ? (
          <a
            href={safePageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="元ページを開く"
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink/60 hover:bg-white/10 hover:text-ink transition"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <span className="flex h-11 w-11 items-center justify-center text-[11px] text-ink/50">—</span>
        )}
      </div>
    </div>
  );
}

export function CompareBoard() {
  const comparedCards = useResearchStore((s) => s.comparedCards);

  if (comparedCards.length === 0) {
    return (
      <div className="glass border-dashed p-6 text-center">
        <p className="text-sm text-ink/80">比較に追加すると、ここで並べて見比べられます</p>
        <p className="mt-1 text-xs text-ink/65">
          気になるカードの「比較に追加」を押すと、利益計算にワンタップで反映できます。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {comparedCards.map((card) => (
        <CompareCardItem key={card.id} card={card} />
      ))}
      {comparedCards.length >= MAX_COMPARED_CARDS && (
        <p className="text-[11px] text-amber-100">比較ボードは最大{MAX_COMPARED_CARDS}件です。不要なカードを外すと追加できます。</p>
      )}
    </div>
  );
}
