import { useState } from 'react';
import { ExternalLink, LayoutGrid } from 'lucide-react';
import type { SearchShortcut } from '../types/market';
import { MANUAL_MARKETS } from '../services/searchLinkBuilder';

type Props = {
  shortcuts: SearchShortcut[];
};

const DEFAULT_SELECTED = new Set(MANUAL_MARKETS.map((m) => m.shortcutId));

/** 画面を n 個に格子状に分けた、各ウィンドウの位置と大きさ。 */
export function tileLayout(count: number, screen: { width: number; height: number; left: number; top: number }) {
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const width = Math.floor(screen.width / cols);
  const height = Math.floor(screen.height / rows);
  return Array.from({ length: count }, (_, i) => ({
    left: screen.left + (i % cols) * width,
    top: screen.top + Math.floor(i / cols) * height,
    width,
    height,
  }));
}

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

  const openTiled = () => {
    const targets = shortcuts.filter((sc) => selected.has(sc.id));
    const scr = window.screen as Screen & { availLeft?: number; availTop?: number };
    const tiles = tileLayout(targets.length, {
      width: scr.availWidth || window.innerWidth,
      height: scr.availHeight || window.innerHeight,
      left: scr.availLeft ?? 0,
      top: scr.availTop ?? 0,
    });
    let failed = 0;
    targets.forEach((sc, i) => {
      const t = tiles[i];
      const win = window.open(
        sc.url,
        `market-${sc.id}`,
        `popup=yes,width=${t.width},height=${t.height},left=${t.left},top=${t.top}`,
      );
      if (!win) failed += 1;
      else win.opener = null;
    });
    setBlocked(failed);
  };

  return (
    <section className="glass border-sky-400/25 bg-sky-500/10 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-sky-200">検索ショートカット（外部ページ）</h2>
          <p className="text-xs text-sky-100/85">
            ここは価格カードではありません。チェックしたサイトは「まとめて開く」で画面を分割して同時に表示できます。
          </p>
        </div>
        <button
          type="button"
          onClick={openTiled}
          disabled={selected.size === 0}
          className="flex min-h-11 items-center gap-1.5 rounded-control bg-accent-strong px-4 text-xs font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LayoutGrid size={14} aria-hidden="true" />
          まとめて開く（画面分割・{selected.size}サイト）
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
