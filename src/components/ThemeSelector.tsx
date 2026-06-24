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
      <Palette size={15} className="text-ink/50 shrink-0" />
      <div className="flex gap-1.5">
        {themes.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              title={t.label}
              aria-label={`テーマ: ${t.label}`}
              aria-pressed={active}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition sm:px-3 ${
                active
                  ? 'border-accent/70 bg-accent/15 text-accent font-semibold ring-2 ring-accent/50'
                  : 'border-white/12 bg-white/5 text-ink/60 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <span className={`h-3.5 w-3.5 rounded-full ring-1 ring-white/20 ${t.preview}`} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
