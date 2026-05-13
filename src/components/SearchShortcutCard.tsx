import { ExternalLink } from 'lucide-react';
import type { SearchShortcut } from '../types/market';

type Props = {
  shortcuts: SearchShortcut[];
};

export function SearchShortcutCard({ shortcuts }: Props) {
  if (shortcuts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4">
      <div className="mb-3 flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-sky-200">検索ショートカット（外部ページ）</h2>
        <p className="text-xs text-sky-100/70">
          ここは価格カードではありません。クリックすると別タブで検索ページを開きます。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shortcuts.map((sc) => (
          <a
            key={sc.id}
            href={sc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1 rounded-xl border border-sky-300/20 bg-sky-950/20 p-3 hover:bg-sky-900/30 transition group"
          >
            <span className="text-sm font-semibold group-hover:text-accent transition">{sc.siteName}</span>
            <span className="text-xs leading-snug text-slate-400">{sc.description}</span>
            <span className="line-clamp-2 break-all text-[11px] text-sky-100/50">{sc.url}</span>
            <span className="mt-1 flex items-center gap-1 text-xs text-accent">
              <ExternalLink size={11} />
              検索リンクを開く
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
