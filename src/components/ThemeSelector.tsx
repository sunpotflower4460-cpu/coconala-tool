import { Palette } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { ThemeId } from '../types/market';

const themes: { id: ThemeId; label: string; preview: string }[] = [
  { id: 'simple-pro', label: 'Simple Pro', preview: 'bg-slate-900' },
  { id: 'soft-market', label: 'Soft Market', preview: 'bg-violet-900' },
  { id: 'dark-trader', label: 'Dark Trader', preview: 'bg-zinc-950' },
  { id: 'natural-board', label: 'Natural Board', preview: 'bg-emerald-950' },
];

export function ThemeSelector() {
  const { theme, setTheme } = useResearchStore();

  return (
    <div className="flex items-center gap-2">
      <Palette size={15} className="text-slate-400 shrink-0" />
      <div className="flex gap-1.5">
        {themes.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTheme(t.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition border ${
              theme === t.id
                ? 'border-accent bg-accent/20 text-accent font-semibold'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <span className={`h-3 w-3 rounded-full ${t.preview}`} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
