import { ShieldCheck } from 'lucide-react';

const apiPlans = [
  'v0.1 Demo では APIキーは不要です。将来もフロントエンドに固定値では書かず、サーバー/Workerの環境変数で管理します。',
  '楽天APIモックは将来の公式API接続フロー確認用の疑似データです。リアルタイム取得ではありません。',
  'メルカリ・ヤフオクは検索リンクを開いて手動確認する前提で扱います。',
];

export function ApiStatusPanel() {
  return (
    <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-emerald-200" />
        <h2 className="text-sm font-semibold text-emerald-100">API接続準備ステータス</h2>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5 text-xs text-slate-200">
        {apiPlans.map((item) => (
          <li key={item} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
