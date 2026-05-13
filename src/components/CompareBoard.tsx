import { ExternalLink, X } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { MarketCard } from '../types/market';

function CompareCardItem({ card }: { card: MarketCard }) {
  const { removeComparedCard } = useResearchStore();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.title}
          className="h-12 w-16 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium">{card.title}</p>
        <p className="text-lg font-bold text-accent">{card.priceText || '価格不明'}</p>
        <p className="text-xs text-slate-400">{card.siteName}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <button
          onClick={() => removeComparedCard(card.id)}
          className="text-slate-400 hover:text-red-400 transition"
        >
          <X size={15} />
        </button>
        <a
          href={card.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-white transition"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

export function CompareBoard() {
  const { comparedCards } = useResearchStore();

  if (comparedCards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-slate-400">比較したいカードの「比較に追加」をクリックしてください</p>
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
