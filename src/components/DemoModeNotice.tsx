import { useId, useState } from 'react';

const demoModeItems = [
  {
    title: 'まとめて（楽天・Yahoo!・eBay）',
    description:
      '楽天市場・Yahoo!ショッピング・eBay の公式APIを同時に検索して1つの一覧に並べます。キーを設定したサイトは実データ、未設定のサイトは理由を表示します（eBay はドル建てを円換算して比較）。',
  },
  {
    title: 'メルカリ / ヤフオク / ラクマ / Amazon',
    description:
      '自動取得はしません（公式の検索APIが無い・規約で禁止されているため）。相場一覧の「開く」または「まとめて開く（画面分割）」で検索ページを見て、見た価格を入力すると同じ目盛りで並びます。',
  },
  {
    title: '接続できないとき',
    description:
      '実在しない商品（見本）を代わりに出すことはありません。理由を表示するので、相場一覧から検索ページを開き、ページをコピーして貼り付けるか、見た価格を入力してください。',
  },
] as const;

export function DemoModeNotice() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="glass border-sky-300/25 bg-sky-500/10 p-4 text-xs text-sky-50">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-semibold text-sky-100"
      >
        データの種類の見かた
        <span className="text-[11px] text-sky-100/80">{isOpen ? '閉じる' : '開く'}</span>
      </button>
      {isOpen && (
        <div id={panelId} className="mt-3 grid gap-2 sm:grid-cols-2">
          {demoModeItems.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-slate-200"
            >
              <p className="font-semibold text-sky-100">{item.title}</p>
              <p className="mt-1 leading-relaxed text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
