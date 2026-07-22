import { Download } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { downloadResearchCsv } from '../features/export/csvExport';

export function ExportPanel() {
  const { comparedCards, profitSettings, dataSourceMode, searchStatus, searchWarnings, lastSearchedAt } =
    useResearchStore();
  const canExport = comparedCards.length > 0;

  return (
    <section className="glass p-4">
      <h2 className="font-display text-sm font-semibold text-ink/80">CSVエクスポート</h2>
      <p className="mt-1 text-xs text-ink/60">
        比較カードと利益設定をCSVで保存します（Excel向けに文字化けしにくい形式）。
      </p>
      {!canExport && (
        <p className="mt-2 rounded-control border border-dashed border-white/12 p-2 text-xs text-ink/55">
          比較ボードにカードを追加するとCSV出力できます。
        </p>
      )}
      <button
        onClick={() =>
          downloadResearchCsv(comparedCards, profitSettings, {
            dataSourceMode,
            searchStatus,
            searchWarnings,
            lastSearchedAt,
          })
        }
        disabled={!canExport}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-control bg-accent/85 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={13} />
        比較中カードをCSV出力
      </button>
    </section>
  );
}
