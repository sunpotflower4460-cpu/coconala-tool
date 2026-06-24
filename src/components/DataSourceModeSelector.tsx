import { useResearchStore } from '../store/researchStore';
import type { DataSourceMode } from '../types/market';

const modeOptions = [
  { value: 'sample', label: 'サンプルデータ' },
  { value: 'rakuten_mock', label: '楽天APIモック' },
] as const;

const currentModeLabels: Record<DataSourceMode, string> = {
  sample: 'サンプル',
  rakuten_mock: '楽天APIモック',
};

const modeNotices: Record<DataSourceMode, string> = {
  sample: 'サンプルデータは画面確認や比較フロー確認向けの固定カードです。リアルタイム取得ではありません。',
  rakuten_mock:
    '楽天APIモックは将来の公式API接続を想定した疑似データです。まだ実APIには接続していません。',
};

export function DataSourceModeSelector() {
  const { dataSourceMode, setDataSourceMode } = useResearchStore();

  return (
    <div className="glass px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink/70">データソース:</span>
          <select
            value={dataSourceMode}
            onChange={(event) => setDataSourceMode(event.target.value as DataSourceMode)}
            aria-label="データソースを選ぶ"
            className="glass-input bg-black/30 px-2 py-1 text-xs text-ink"
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="rounded-full border border-sky-300/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-100">
          現在のデータ: {currentModeLabels[dataSourceMode]}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink/65">{modeNotices[dataSourceMode]}</p>
    </div>
  );
}
