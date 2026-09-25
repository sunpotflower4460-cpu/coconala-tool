import { useState } from 'react';
import { ExternalLink, LayoutGrid } from 'lucide-react';
import type { SearchShortcut } from '../types/market';
import { MANUAL_MARKETS } from '../services/searchLinkBuilder';
import { openTiled } from '../lib/tiledWindows';

type Props = {
  shortcuts: SearchShortcut[];
};

const DEFAULT_SELECTED = new Set(MANUAL_MARKETS.map((m) => m.shortcutId));

/**
 * 外部サイトの検索ページ。自動取得はせず、利用者が開いて確かめる。
 * 「まとめて開く（画面分割）」は選んだサイトを別ウィンドウで格子状に並べ、切り替えずに見比べられるようにする。
 * （各サイトは他サイトへの埋め込みを禁止しているため、アプリ内に埋め込むことはしない。）
 */
export function SearchShortcutCard({ shortcuts }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_SELECTED));
  const [blocked, setBlocked] = useState(0);
  if (shortcuts.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openSelected = () => setBlocked(openTiled(shortcuts.filter((sc) => selected.has(sc.id))));

  return (
    <section className="glass border-sky-400/25 bg-sky-500/10 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-sky-200">検索ショートカット（外部ページ）</h2>
          <p className="text-xs text-sky-100/85">
            ここは価格カードではありません。「まとめて開く」で、チェックしたサイトを画面の右側に並べて開きます。
            このツールのウィンドウを画面の左側（3分の1ほど）に寄せておくと、相場一覧を見ながら各サイトを確認できます。
          </p>
        </div>
        <button
          type="button"
          onClick={openSelected}
          disabled={selected.size === 0}
          className="flex min-h-11 items-center gap-1.5 rounded-control bg-accent-strong px-4 text-xs font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LayoutGrid size={14} aria-hidden="true" />
          まとめて開く（右側に画面分割・{selected.size}サイト）
        </button>
      </div>
      {blocked > 0 && (
        <p role="alert" className="mb-3 rounded-control border border-amber-300/30 bg-amber-500/10 p-2 text-xs text-amber-50">
          ブラウザが {blocked} 個のウィンドウをブロックしました。アドレスバー右端の「ポップアップ」アイコンから、このサイトのポップアップを許可してもう一度押してください。
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shortcuts.map((sc) => (
          <div key={sc.id} className="flex flex-col gap-1 rounded-xl border border-sky-300/20 bg-sky-950/20 p-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={selected.has(sc.id)}
                onChange={() => toggle(sc.id)}
                className="h-5 w-5 accent-[rgb(var(--color-accent))]"
                aria-label={`${sc.siteName} をまとめて開く対象にする`}
              />
              {sc.siteName}
            </label>
            <span className="text-xs leading-snug text-slate-200">{sc.description}</span>
            <a
              href={sc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex min-h-11 items-center gap-1 text-xs font-semibold text-sky-200 hover:underline"
            >
              <ExternalLink size={11} aria-hidden="true" />
              {sc.siteName}の検索ページを開く
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
