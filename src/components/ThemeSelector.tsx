import { Palette } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { ThemeId } from '../types/market';

// 見本の丸はテーマの差し色で塗り分け、スマホ（ラベル非表示）でも区別できるようにする。
const themes: { id: ThemeId; label: string; preview: string }[] = [
  { id: 'simple-pro', label: 'Simple Pro', preview: 'bg-indigo-400' },
  { id: 'soft-market', label: 'Soft Market', preview: 'bg-pink-400' },
  { id: 'dark-trader', label: 'Dark Trader', preview: 'bg-cyan-400' },
  { id: 'natural-board', label: 'Natural Board', preview: 'bg-lime-500' },
];

export function ThemeSelector() {
  const theme = useResearchStore((s) => s.theme);
  const setTheme = useResearchStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-2">
      <Palette size={15} className="text-ink/60 shrink-0" aria-hidden="true" />
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
              type="button"
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-xs transition sm:px-3 ${
                active
                  ? 'border-accent/70 bg-accent/15 text-accent-text font-semibold ring-2 ring-accent/50'
                  : 'border-white/12 bg-white/5 text-ink/60 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <span aria-hidden="true" className={`h-4 w-4 rounded-full ring-1 ring-white/30 ${t.preview}`} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
