import { useId, useState } from 'react';

const demoModeItems = [
  {
    title: 'サンプルデータ',
    description: 'UI確認・比較・CSV出力・履歴保存などの基本フローを体験するための固定データです。',
  },
  {
    title: '楽天APIモック',
    description: '将来の公式API接続を想定した疑似レスポンスです。リアルタイムの楽天データ取得ではありません。',
  },
  {
    title: 'メルカリ / ヤフオク',
    description: 'まずは検索リンクを開いて手動確認する前提です。高頻度スクレイピングは行いません。',
  },
  {
    title: '実API接続',
    description: '次フェーズで Cloudflare Workers などのサーバー/Worker 経由に切り替えて安全に追加します。',
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
        className="flex w-full items-center justify-between gap-3 text-left font-semibold text-sky-100"
      >
        デモモードの見かた
        <span className="text-[11px] text-sky-100/70">{isOpen ? '閉じる' : '開く'}</span>
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
