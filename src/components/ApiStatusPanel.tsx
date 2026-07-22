import { ShieldCheck } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { DataSourceMode } from '../types/market';

const apiPlans = [
  'APIキーが未設定でも動作します。将来もフロントエンドに固定値では書かず、サーバー/Workerの環境変数で管理します。',
  '楽天APIモックは公式API接続フロー確認用の疑似データです。キー設定時のみ実データに切り替わります。',
  'メルカリ・ヤフオクは検索リンクを開いて手動確認する前提で扱います。',
];

const currentSourceLabel: Record<DataSourceMode, string> = {
  sample: 'サンプルデータ（UI確認用の固定データ）',
  rakuten_mock: '楽天APIモック（キー設定時のみ公式APIに切替）',
};

export function ApiStatusPanel() {
  const { dataSourceMode } = useResearchStore();

  return (
    <section className="glass border-emerald-300/25 bg-emerald-500/10 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-emerald-200" />
        <h2 className="text-sm font-semibold text-emerald-100">API接続準備ステータス</h2>
      </div>
      <p className="mt-2 rounded-lg border border-emerald-300/20 bg-black/20 px-2.5 py-2 text-xs text-emerald-50">
        現在のデータソース: <span className="font-semibold">{currentSourceLabel[dataSourceMode]}</span>
      </p>
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
