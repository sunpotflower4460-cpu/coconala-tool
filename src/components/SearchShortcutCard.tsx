import { ExternalLink } from 'lucide-react';
import type { SearchShortcut } from '../types/market';

type Props = {
  shortcuts: SearchShortcut[];
};

export function SearchShortcutCard({ shortcuts }: Props) {
  if (shortcuts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-300">検索ショートカット</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shortcuts.map((sc) => (
          <a
            key={sc.id}
            href={sc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition group"
          >
            <span className="text-sm font-semibold group-hover:text-accent transition">{sc.siteName}</span>
            <span className="text-xs text-slate-400 leading-snug">{sc.description}</span>
            <span className="mt-1 flex items-center gap-1 text-xs text-accent">
              <ExternalLink size={11} />
              検索リンクを開く
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
