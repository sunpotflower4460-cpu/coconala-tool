import { Download } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { downloadResearchCsv } from '../features/export/csvExport';

export function ExportPanel() {
  const { comparedCards, profitSettings } = useResearchStore();
  const canExport = comparedCards.length > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-semibold text-slate-200">CSVエクスポート</h2>
      <p className="mt-1 text-xs text-slate-400">
        比較カードと利益設定をCSVで保存します（Excel向けに文字化けしにくい形式）。
      </p>
      {!canExport && (
        <p className="mt-2 rounded-xl border border-dashed border-white/10 p-2 text-xs text-slate-400">
          比較ボードにカードを追加するとCSV出力できます。
        </p>
      )}
      <button
        onClick={() => downloadResearchCsv(comparedCards, profitSettings)}
        disabled={!canExport}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent/80 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={13} />
        比較中カードをCSV出力
      </button>
    </section>
  );
}
