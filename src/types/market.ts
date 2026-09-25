export type SourceType = 'official_api' | 'search_api' | 'search_link' | 'manual';
/**
 * データソース。値 `rakuten_mock` は保存データとの互換のため名前を変えずに「楽天市場のみ」を表す。
 * `multi` は楽天・Yahoo!ショッピング・eBay の公式APIを同時に検索する。
 */
export type DataSourceMode = 'sample' | 'rakuten_mock' | 'multi';

/** カードがどの販売サイトのものか（相場一覧の行・絞り込みに使う）。 */
export type MarketId = 'rakuten' | 'yahoo_shopping' | 'ebay' | 'mercari' | 'yahoo_auctions' | 'rakuma' | 'amazon' | 'other';

export const MARKET_LABELS: Record<MarketId, string> = {
  rakuten: '楽天市場',
  yahoo_shopping: 'Yahoo!ショッピング',
  ebay: 'eBay',
  mercari: 'メルカリ',
  yahoo_auctions: 'ヤフオク',
  rakuma: 'ラクマ',
  amazon: 'Amazon',
  other: 'その他',
};

/** 公式APIで自動取得できるサイト（まとめて検索の対象）。 */
export type OfficialMarketId = 'rakuten' | 'yahoo_shopping' | 'ebay';

/** まとめて検索での、サイトごとの結果。 */
export type SourceResult = {
  market: OfficialMarketId;
  outcome: 'ok' | 'empty' | 'invalid_query' | 'failed';
  count: number;
  /** 利用者向けの一言（失敗理由など） */
  message?: string;
};

export type MarketSearchStatus =
  | 'sample'
  | 'official_api'
  | 'mock_no_key'
  | 'mock_timeout'
  | 'mock_network'
  | 'mock_rate_limited'
  | 'mock_upstream_error'
  | 'mock_setup_error'
  | 'invalid_query'
  | 'empty';

export type MarketSearchResponse = {
  cards: MarketCard[];
  status: MarketSearchStatus;
  warnings: string[];
  searchedAt: string;
  /** まとめて検索のときだけ。サイトごとの結果。 */
  sources?: SourceResult[];
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_api: '公式API取得',
  search_api: '検索表示から推定',
  search_link: '検索リンク',
  manual: '手動追加',
};

export const DATA_SOURCE_MODE_LABELS: Record<DataSourceMode, string> = {
  sample: 'サンプル',
  rakuten_mock: '楽天市場のみ',
  multi: 'まとめて（楽天・Yahoo!・eBay）',
};

export const SEARCH_STATUS_LABELS: Record<MarketSearchStatus, string> = {
  official_api: '実データ（公式API）',
  empty: '実データ（0件）',
  sample: 'サンプルデータ',
  mock_no_key: '見本データ（連携の設定前）',
  mock_setup_error: '見本データ（連携の設定を確認）',
  mock_timeout: '見本データ（応答待ちが長すぎた）',
  mock_network: '見本データ（通信できなかった）',
  mock_rate_limited: '見本データ（アクセス集中）',
  mock_upstream_error: '見本データ（接続先の一時的な不具合）',
  invalid_query: '検索語を確認してください',
};

/** 実データではない（サンプル・見本データ）検索状態。デモ表示の判定に使う。 */
export function isDemoSearchStatus(status: MarketSearchStatus | null): boolean {
  return status === 'sample' || (status !== null && status.startsWith('mock_'));
}

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
  /** 販売サイト。無い古いデータは URL から判定する（`marketOf`）。 */
  market?: MarketId;
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
