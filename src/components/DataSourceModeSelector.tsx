import { useResearchStore } from '../store/researchStore';
import type { DataSourceMode } from '../types/market';
import { IS_STATIC_BUILD } from '../lib/deployMode';

const modeOptions = [
  { value: 'multi', label: 'まとめて（楽天・Yahoo!・eBay）' },
  { value: 'rakuten_mock', label: '楽天市場のみ' },
  { value: 'sample', label: 'サンプルデータ' },
] as const;

const currentModeLabels: Record<DataSourceMode, string> = {
  sample: 'サンプル',
  rakuten_mock: '楽天市場',
  multi: '楽天・Yahoo!・eBay',
};

const modeNotices: Record<DataSourceMode, string> = {
  sample: 'サンプルデータは画面や操作の確認用の固定カードです（PS5関連）。検索語で絞り込めます。リアルタイム取得ではありません。',
  rakuten_mock: IS_STATIC_BUILD
    ? 'この版は楽天市場と連携していないため、見本データを表示します。実データを使うには Workers 版で公開してください。'
    : '楽天市場の商品を検索します。楽天の設定がまだ・接続できない時は、理由を表示して見本データに切り替えます。',
  multi: IS_STATIC_BUILD
    ? 'この版は楽天市場・Yahoo!ショッピング・eBay と連携していないため、見本データを表示します。実データを使うには Workers 版で公開してください。'
    : '楽天市場・Yahoo!ショッピング・eBay を同時に検索して1つの一覧に並べます。設定していないサイトは理由を表示し、他のサイトの結果だけを表示します。',
};

export function DataSourceModeSelector() {
  const dataSourceMode = useResearchStore((s) => s.dataSourceMode);
  const setDataSourceMode = useResearchStore((s) => s.setDataSourceMode);

  return (
    <div className="glass px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink/70">データソース:</span>
          <select
            value={dataSourceMode}
            onChange={(event) => setDataSourceMode(event.target.value as DataSourceMode)}
            aria-label="データソースを選ぶ"
            className="glass-input h-11 bg-black/30 px-2 py-1 text-xs text-ink"
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
      <p className="mt-1 text-[11px] text-ink/75">{modeNotices[dataSourceMode]}</p>
    </div>
  );
}
