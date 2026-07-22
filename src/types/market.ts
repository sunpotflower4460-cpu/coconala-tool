export type SourceType = 'official_api' | 'search_api' | 'search_link' | 'manual';
export type DataSourceMode = 'sample' | 'rakuten_mock';

export type MarketSearchStatus =
  | 'sample'
  | 'official_api'
  | 'mock_no_key'
  | 'mock_timeout'
  | 'mock_network'
  | 'mock_rate_limited'
  | 'mock_upstream_error'
  | 'empty';

export type MarketSearchResponse = {
  cards: MarketCard[];
  status: MarketSearchStatus;
  warnings: string[];
  searchedAt: string;
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_api: '公式API取得',
  search_api: '検索表示から推定',
  search_link: '検索リンク',
  manual: '手動追加',
};

export const DATA_SOURCE_MODE_LABELS: Record<DataSourceMode, string> = {
  sample: 'サンプル',
  rakuten_mock: '楽天市場',
};

export const SEARCH_STATUS_LABELS: Record<MarketSearchStatus, string> = {
  official_api: '公式API取得（実データ）',
  empty: '公式API取得（0件）',
  sample: 'サンプルデータ',
  mock_no_key: 'モック（キー未設定）',
  mock_timeout: 'モック（タイムアウト）',
  mock_network: 'モック（通信失敗）',
  mock_rate_limited: 'モック（レート超過）',
  mock_upstream_error: 'モック（上流エラー）',
};

export type MarketCard = {
  id: string;
  title: string;
  siteName: string;
  sourceType: SourceType;
  priceText?: string;
  priceValue?: number;
  currency?: 'JPY' | 'USD' | 'EUR' | 'OTHER';
  imageUrl?: string;
  pageUrl: string;
  shippingText?: string;
  conditionText?: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
  createdAt: string;
  /**
   * デモ由来カードの明示用。実データ（公式API）には付与しない。
   * 'sample' = UI確認用の固定サンプル、'mock' = 楽天API想定の擬似データ。
   */
  demoOrigin?: 'sample' | 'mock';
};

export type ResearchSession = {
  id: string;
  query: string;
  cards: MarketCard[];
  comparedCardIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SavedResearchSession = {
  id: string;
  name: string;
  query: string;
  resultCards: MarketCard[];
  comparedCards: MarketCard[];
  profitSettings: ProfitSettings;
  createdAt: string;
  updatedAt: string;
  /** 保存時点のデータソース・検索状態のスナップショット。復元時にライブな状態として扱わないこと。 */
  dataSourceMode: DataSourceMode;
  searchStatus: MarketSearchStatus | null;
  searchWarnings: string[];
  lastSearchedAt: string | null;
};

export type ProfitSettings = {
  buyPrice: number;
  sellPrice: number;
  shippingCost: number;
  feeRate: number;
  exchangeRate: number;
};

export type ThemeId = 'simple-pro' | 'soft-market' | 'dark-trader' | 'natural-board';

export type SearchShortcut = {
  id: string;
  siteName: string;
  description: string;
  url: string;
};
