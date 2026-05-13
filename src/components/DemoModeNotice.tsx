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
  return (
    <details className="rounded-2xl border border-sky-300/20 bg-sky-500/5 p-4 text-xs text-sky-50">
      <summary className="cursor-pointer list-none font-semibold text-sky-100">
        デモモードの見かた
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
    </details>
  );
}
