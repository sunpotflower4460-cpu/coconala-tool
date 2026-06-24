export type SourceType = 'official_api' | 'search_api' | 'search_link' | 'manual';
export type DataSourceMode = 'sample' | 'rakuten_mock';

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
