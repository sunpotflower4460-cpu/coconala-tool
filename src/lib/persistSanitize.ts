import type {
  DataSourceMode,
  MarketCard,
  ProfitSettings,
  SavedResearchSession,
  SourceType,
  ThemeId,
} from '../types/market';
import { clampAmount, clampFeeRate } from '../features/profit/profitCalculator';
import {
  MAX_CARD_CONDITION_TEXT_LENGTH,
  MAX_CARD_NOTE_LENGTH,
  MAX_CARD_PRICE_TEXT_LENGTH,
  MAX_CARD_SHIPPING_TEXT_LENGTH,
  MAX_CARD_SITE_NAME_LENGTH,
  MAX_CARD_TITLE_LENGTH,
  MAX_HISTORY_NAME_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
} from './limits';
import { toSafeHttpUrl, toSafeHttpsUrl } from './safeUrl';

export const RESEARCH_STORAGE_KEY = 'coconala-tool-research';
export const HISTORY_STORAGE_KEY = 'coconala-tool-history';
export const RESEARCH_PERSIST_VERSION = 1;
export const HISTORY_PERSIST_VERSION = 1;

const THEME_IDS: ThemeId[] = ['simple-pro', 'soft-market', 'dark-trader', 'natural-board'];
const DATA_SOURCE_MODES: DataSourceMode[] = ['sample', 'rakuten_mock'];
const SOURCE_TYPES: SourceType[] = ['official_api', 'search_api', 'search_link', 'manual'];
const CONFIDENCES = ['high', 'medium', 'low'] as const;
const CURRENCIES = ['JPY', 'USD', 'EUR', 'OTHER'] as const;
const DEMO_ORIGINS = ['sample', 'mock'] as const;

export const defaultProfitSettings: ProfitSettings = {
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 0,
  feeRate: 10,
  exchangeRate: 155,
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

export function sanitizeDataSourceMode(value: unknown): DataSourceMode | undefined {
  return DATA_SOURCE_MODES.includes(value as DataSourceMode) ? (value as DataSourceMode) : undefined;
}

export function sanitizeThemeId(value: unknown): ThemeId | undefined {
  return THEME_IDS.includes(value as ThemeId) ? (value as ThemeId) : undefined;
}

export function sanitizeProfitSettings(value: unknown): ProfitSettings {
  const record = asRecord(value);
  if (!record) return { ...defaultProfitSettings };
  return {
    buyPrice: clampAmount(Number(record.buyPrice)),
    sellPrice: clampAmount(Number(record.sellPrice)),
    shippingCost: clampAmount(Number(record.shippingCost)),
    feeRate: clampFeeRate(Number(record.feeRate ?? defaultProfitSettings.feeRate)),
    exchangeRate: clampAmount(Number(record.exchangeRate ?? defaultProfitSettings.exchangeRate)),
  };
}

export function sanitizeMarketCard(value: unknown): MarketCard | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  if (typeof record.id !== 'string' || !record.id) return undefined;

  const sourceType = SOURCE_TYPES.includes(record.sourceType as SourceType)
    ? (record.sourceType as SourceType)
    : 'manual';
  const confidence = CONFIDENCES.includes(record.confidence as (typeof CONFIDENCES)[number])
    ? (record.confidence as MarketCard['confidence'])
    : 'low';
  const currency = CURRENCIES.includes(record.currency as (typeof CURRENCIES)[number])
    ? (record.currency as MarketCard['currency'])
    : undefined;
  const demoOrigin = DEMO_ORIGINS.includes(record.demoOrigin as (typeof DEMO_ORIGINS)[number])
    ? (record.demoOrigin as MarketCard['demoOrigin'])
    : undefined;

  const rawPrice = Number(record.priceValue);
  const priceValue = Number.isFinite(rawPrice) ? clampAmount(rawPrice) : undefined;

  return {
    id: record.id.slice(0, 200),
    title: clampText(record.title, MAX_CARD_TITLE_LENGTH) || '無題のカード',
    siteName: clampText(record.siteName, MAX_CARD_SITE_NAME_LENGTH) || '不明',
    sourceType,
    priceText: record.priceText === undefined ? undefined : clampText(record.priceText, MAX_CARD_PRICE_TEXT_LENGTH),
    priceValue,
    currency,
    imageUrl: toSafeHttpsUrl(record.imageUrl),
    pageUrl: toSafeHttpUrl(record.pageUrl) ?? '',
    shippingText:
      record.shippingText === undefined ? undefined : clampText(record.shippingText, MAX_CARD_SHIPPING_TEXT_LENGTH),
    conditionText:
      record.conditionText === undefined ? undefined : clampText(record.conditionText, MAX_CARD_CONDITION_TEXT_LENGTH),
    confidence,
    note: record.note === undefined ? undefined : clampText(record.note, MAX_CARD_NOTE_LENGTH),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    demoOrigin,
  };
}

export function sanitizeCards(value: unknown): MarketCard[] {
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeMarketCard).filter((card): card is MarketCard => Boolean(card));
}

export function sanitizeSavedSession(value: unknown): SavedResearchSession | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  if (typeof record.id !== 'string' || !record.id) return undefined;

  return {
    id: record.id.slice(0, 200),
    name: clampText(record.name, MAX_HISTORY_NAME_LENGTH) || '無題のリサーチ',
    query: clampText(record.query, MAX_SEARCH_QUERY_LENGTH),
    resultCards: sanitizeCards(record.resultCards),
    comparedCards: sanitizeCards(record.comparedCards),
    profitSettings: sanitizeProfitSettings(record.profitSettings),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
    dataSourceMode: sanitizeDataSourceMode(record.dataSourceMode) ?? 'sample',
    searchStatus: null,
    searchWarnings: [],
    lastSearchedAt: null,
  };
}

export type ResearchPersistedSlice = {
  dataSourceMode: DataSourceMode;
  theme: ThemeId;
  profitSettings: ProfitSettings;
};

export function sanitizeResearchPersisted(value: unknown): Partial<ResearchPersistedSlice> {
  const record = asRecord(value);
  if (!record) return {};
  const dataSourceMode = sanitizeDataSourceMode(record.dataSourceMode);
  const theme = sanitizeThemeId(record.theme);
  return {
    ...(dataSourceMode ? { dataSourceMode } : {}),
    ...(theme ? { theme } : {}),
    ...(record.profitSettings !== undefined ? { profitSettings: sanitizeProfitSettings(record.profitSettings) } : {}),
  };
}

export function sanitizeHistoryPersisted(value: unknown): { sessions: SavedResearchSession[] } {
  const record = asRecord(value);
  const sessions = Array.isArray(record?.sessions) ? record.sessions : Array.isArray(value) ? value : [];
  return {
    sessions: sessions.map(sanitizeSavedSession).filter((session): session is SavedResearchSession => Boolean(session)),
  };
}
