import { ShieldCheck } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { SEARCH_STATUS_LABELS, type DataSourceMode } from '../types/market';
import { IS_STATIC_BUILD } from '../lib/deployMode';

const notes = [
  '楽天・Yahoo!・eBay のキーはサーバー側だけで管理し、画面やブラウザには保存しません。',
  '接続できないサイトがあるときは理由を表示します。どのサイトにも接続できないときだけ見本データに切り替えます。',
  'メルカリ・ヤフオク・ラクマ・Amazon は、検索ページを開いて見た価格を相場一覧に入力する使い方です（自動取得はしません）。',
];

const currentSourceLabel: Record<DataSourceMode, string> = {
  sample: 'サンプルデータ（操作確認用の固定データ）',
  rakuten_mock: IS_STATIC_BUILD
    ? '楽天市場（この公開版では見本データのみ）'
    : '楽天市場（設定済みなら実データ、未設定・接続できない時は見本データ）',
  multi: IS_STATIC_BUILD
    ? '楽天・Yahoo!ショッピング・eBay（この公開版では見本データのみ）'
    : '楽天・Yahoo!ショッピング・eBay をまとめて検索（設定済みのサイトは実データ）',
};

export function ApiStatusPanel() {
  const dataSourceMode = useResearchStore((s) => s.dataSourceMode);
  const searchStatus = useResearchStore((s) => s.searchStatus);

  return (
    <section className="glass border-emerald-300/25 bg-emerald-500/10 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-emerald-200" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-emerald-100">データの取得状況</h2>
      </div>
      <p className="mt-2 rounded-lg border border-emerald-300/20 bg-black/20 px-2.5 py-2 text-xs text-emerald-50">
        現在のデータソース: <span className="font-semibold">{currentSourceLabel[dataSourceMode]}</span>
      </p>
      {searchStatus && (
        <p className="mt-2 rounded-lg border border-emerald-300/20 bg-black/20 px-2.5 py-2 text-xs text-emerald-50">
          直近の検索結果: <span className="font-semibold">{SEARCH_STATUS_LABELS[searchStatus]}</span>
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-1.5 text-xs text-slate-100">
        {notes.map((item) => (
          <li key={item} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
