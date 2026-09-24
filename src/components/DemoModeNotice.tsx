import { useId, useState } from 'react';

const demoModeItems = [
  {
    title: 'サンプルデータ',
    description:
      '検索・比較・CSV出力・履歴保存の流れを試すための固定データです（PS5関連）。検索語で絞り込めます。',
  },
  {
    title: '楽天市場',
    description:
      '楽天のアプリIDとアクセスキーをサーバーに設定すると、楽天市場の実データを表示します。未設定のときは見本データ（実在しない商品）を表示します。',
  },
  {
    title: 'メルカリ / ヤフオク / eBay / Yahoo!ショッピング',
    description: '検索リンクから各サイトを開いて確認し、気になる商品は「手動で追加」で比較に入れます。自動での大量取得はしません。',
  },
  {
    title: '楽天以外の公式API',
    description: '現時点では未対応です。導入をご希望の場合は要件確認のうえ追加見積りとなります。',
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
