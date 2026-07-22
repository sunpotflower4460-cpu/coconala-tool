import { ShieldCheck } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import type { DataSourceMode, MarketSearchStatus } from '../types/market';

const apiPlans = [
  'APIキーが未設定でも動作します。将来もフロントエンドに固定値では書かず、サーバー/Workerの環境変数で管理します。',
  '楽天市場は商品検索APIに接続します。キー未設定・通信失敗時のみ自動でモック（擬似データ）に切り替わります。',
  'メルカリ・ヤフオクは検索リンクを開いて手動確認する前提で扱います。',
];

const currentSourceLabel: Record<DataSourceMode, string> = {
  sample: 'サンプルデータ（UI確認用の固定データ）',
  rakuten_mock: '楽天市場（キー設定時は公式API、未設定・失敗時はモック）',
};

const resolvedStatusLabel: Partial<Record<MarketSearchStatus, string>> = {
  official_api: '公式API取得（実データ）',
  empty: '公式API取得（0件）',
  sample: 'サンプルデータ',
  mock_no_key: 'モック（キー未設定）',
  mock_timeout: 'モック（タイムアウト）',
  mock_network: 'モック（通信失敗）',
  mock_rate_limited: 'モック（レート超過）',
  mock_upstream_error: 'モック（上流エラー）',
};

export function ApiStatusPanel() {
  const { dataSourceMode, searchStatus } = useResearchStore();

  return (
    <section className="glass border-emerald-300/25 bg-emerald-500/10 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-emerald-200" />
        <h2 className="text-sm font-semibold text-emerald-100">API接続準備ステータス</h2>
      </div>
      <p className="mt-2 rounded-lg border border-emerald-300/20 bg-black/20 px-2.5 py-2 text-xs text-emerald-50">
        現在のデータソース: <span className="font-semibold">{currentSourceLabel[dataSourceMode]}</span>
      </p>
      {searchStatus && (
        <p className="mt-2 rounded-lg border border-emerald-300/20 bg-black/20 px-2.5 py-2 text-xs text-emerald-50">
          直近の検索結果: <span className="font-semibold">{resolvedStatusLabel[searchStatus] ?? searchStatus}</span>
        </p>
      )}
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
