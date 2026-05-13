import { useResearchStore } from '../store/researchStore';
import type { DataSourceMode } from '../types/market';

const modeOptions = [
  { value: 'sample', label: 'サンプルデータ' },
  { value: 'rakuten_mock', label: '楽天APIモック' },
] as const;

export function DataSourceModeSelector() {
  const { dataSourceMode, setDataSourceMode } = useResearchStore();

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-300">データソース:</span>
        <select
          value={dataSourceMode}
          onChange={(event) => setDataSourceMode(event.target.value as DataSourceMode)}
          className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-slate-100 focus:border-accent/60 focus:outline-none"
        >
          {modeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {dataSourceMode === 'rakuten_mock' && (
        <p className="mt-1 text-[11px] text-amber-200">
          楽天APIモックは将来の公式API接続を想定した疑似データです。
        </p>
      )}
    </div>
  );
}
