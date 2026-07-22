import { calcProfit } from '../profit/profitCalculator';
import {
  DATA_SOURCE_MODE_LABELS,
  SEARCH_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  type DataSourceMode,
  type MarketCard,
  type MarketSearchStatus,
  type ProfitSettings,
} from '../../types/market';

export type CsvSearchMeta = {
  dataSourceMode: DataSourceMode;
  searchStatus: MarketSearchStatus | null;
  searchWarnings: string[];
  lastSearchedAt: string | null;
};

const DEMO_ORIGIN_LABELS: Record<'sample' | 'mock', string> = {
  sample: 'サンプルデータ',
  mock: 'モック（楽天API想定）',
};

const cardHeader = [
  '商品名',
  'サイト名',
  'データ種別',
  'ソース区分',
  '価格表示',
  '価格',
  '通貨',
  '送料',
  '状態',
  '信頼度',
  '元URL',
  'メモ',
  '取得日時',
];

/**
 * CSV Formula Injection 対策。セルの先頭が `=` `+` `-` `@` の場合、
 * 表計算ソフトが数式として評価しないよう先頭にテキストマーカー（`'`）を付与する。
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  const neutralized = neutralizeFormula(String(value));
  const normalized = neutralized.replace(/"/g, '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

function dataKindLabel(card: MarketCard): string {
  return card.demoOrigin ? DEMO_ORIGIN_LABELS[card.demoOrigin] : '実データ';
}

function toRow(values: Array<string | number | undefined>): string {
  return values.map((value) => escapeCsvCell(value)).join(',');
}

export function buildResearchCsv(
  cards: MarketCard[],
  profitSettings: ProfitSettings,
  generatedAt: string,
  searchMeta?: CsvSearchMeta,
): string {
  const cardRows = cards.map((card) =>
    toRow([
      card.title,
      card.siteName,
      dataKindLabel(card),
      SOURCE_TYPE_LABELS[card.sourceType],
      card.priceText,
      card.priceValue,
      card.currency,
      card.shippingText,
      card.conditionText,
      card.confidence,
      card.pageUrl,
      card.note,
      card.createdAt,
    ]),
  );

  const estimatedProfit = calcProfit(
    profitSettings.sellPrice,
    profitSettings.buyPrice,
    profitSettings.shippingCost,
    profitSettings.feeRate,
  );

  const summaryRows = [
    ['項目', '値'],
    ['生成日時', generatedAt],
    ['データソース', searchMeta ? DATA_SOURCE_MODE_LABELS[searchMeta.dataSourceMode] : ''],
    ['検索状態', searchMeta?.searchStatus ? SEARCH_STATUS_LABELS[searchMeta.searchStatus] : ''],
    ['検索日時', searchMeta?.lastSearchedAt ?? ''],
    ['警告', (searchMeta?.searchWarnings ?? []).join(' / ')],
    ['仕入れ価格', profitSettings.buyPrice],
    ['販売価格', profitSettings.sellPrice],
    ['送料', profitSettings.shippingCost],
    ['手数料率(%)', profitSettings.feeRate],
    ['為替レート', profitSettings.exchangeRate],
    ['利益見込み', estimatedProfit],
  ].map(toRow);

  return [toRow(cardHeader), ...cardRows, '', ...summaryRows].join('\n');
}

/**
 * ダウンロード用のファイル内容（Excel の文字化け対策に UTF-8 BOM を先頭付与）。
 */
export function buildCsvFileContent(
  cards: MarketCard[],
  profitSettings: ProfitSettings,
  generatedAt: string,
  searchMeta?: CsvSearchMeta,
): string {
  return `\uFEFF${buildResearchCsv(cards, profitSettings, generatedAt, searchMeta)}`;
}

export function downloadResearchCsv(
  cards: MarketCard[],
  profitSettings: ProfitSettings,
  searchMeta?: CsvSearchMeta,
): void {
  const generatedAt = new Date().toISOString();
  const csv = buildCsvFileContent(cards, profitSettings, generatedAt, searchMeta);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `research-session-${generatedAt.replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
