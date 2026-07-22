import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { MarketCard } from '../types/market';
import { toJpyPrice } from '../features/profit/profitCalculator';

function CompareCardItem({ card }: { card: MarketCard }) {
  const [imageError, setImageError] = useState(false);
  const { removeComparedCard, applyPriceFromCard, profitSettings } = useResearchStore();
  const normalizedPrice = toJpyPrice(card, profitSettings.exchangeRate);
  const hasPrice = typeof normalizedPrice === 'number';
  const priceSourceLabel = `${card.siteName}${card.priceText ? ` ${card.priceText}` : ''}`;
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
      {card.imageUrl && !imageError ? (
        <img
          src={card.imageUrl}
          alt={card.title}
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
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink/55">
          <span>{card.siteName}</span>
          {card.currency === 'USD' && hasPrice && (
            <span className="num rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-300">
              {normalizedPrice.toLocaleString()}円換算
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={handleUseAsBuy}
            disabled={!hasPrice}
            className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-ink/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            この価格を仕入れに使う
          </button>
          <button
            onClick={handleUseAsSell}
            disabled={!hasPrice}
            className="rounded-full bg-accent/85 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
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
          <X size={16} />
        </button>
        <a
          href={card.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="元ページを開く"
          className="flex h-9 w-11 items-center justify-center rounded-control text-ink/55 hover:bg-white/10 hover:text-ink transition"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

export function CompareBoard() {
  const { comparedCards } = useResearchStore();

  if (comparedCards.length === 0) {
    return (
      <div className="glass border-dashed p-6 text-center">
        <p className="text-sm text-ink/80">比較に追加すると、ここで並べて見比べられます</p>
        <p className="mt-1 text-xs text-ink/55">
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
    </div>
  );
}
