/**
 * 楽天以外の公式API（Yahoo!ショッピング・eBay）プロキシが返す、共通の商品形と応答封筒。
 * フロントの `officialMarketAdapter` がこの形を読み、`MarketCard` に変換する。
 */
import { RESPONSE_HEADERS, clampText, createRequestId, isHttpsUrl } from './shared';

export type NormalizedMarketItem = {
  id: string;
  title: string;
  shopName: string;
  price: number;
  /** ISO 4217（JPY / USD 等） */
  currency: string;
  imageUrl?: string;
  url: string;
  shippingText?: string;
  conditionText?: string;
};

export type MarketErrorCode =
  | 'method_not_allowed'
  | 'forbidden_origin'
  | 'invalid_query'
  | 'no_key'
  | 'rate_limited'
  | 'upstream_auth'
  | 'upstream_client_error'
  | 'upstream_error'
  | 'invalid_json'
  | 'timeout'
  | 'fetch_failed';

const MAX_PRICE = 100_000_000;

export function marketSuccess(items: NormalizedMarketItem[], requestId: string): Response {
  return new Response(JSON.stringify({ items, source: 'official_api', status: 'ok', requestId }), {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}

export function marketError(error: MarketErrorCode, httpStatus: number, requestId = createRequestId(), upstreamStatus?: number) {
  return new Response(
    JSON.stringify({
      items: [],
      source: 'official_api',
      status: 'error',
      error,
      requestId,
      ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
    }),
    { status: httpStatus, headers: RESPONSE_HEADERS },
  );
}

/** 価格として採用してよい値だけ返す（不正値を 0 にしない）。 */
export function parsePrice(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PRICE) return undefined;
  return parsed;
}

/** 必須項目（識別子・商品名・https URL・価格）が欠けた商品は null。 */
export function buildItem(fields: {
  id: unknown;
  title: unknown;
  shopName: unknown;
  price: unknown;
  currency: unknown;
  imageUrl: unknown;
  url: unknown;
  shippingText?: string;
  conditionText?: string;
}): NormalizedMarketItem | null {
  const id = clampText(fields.id, 200);
  const title = clampText(fields.title, 200);
  const url = isHttpsUrl(fields.url) ? fields.url : '';
  const price = parsePrice(fields.price);
  const currency = typeof fields.currency === 'string' && /^[A-Z]{3}$/.test(fields.currency) ? fields.currency : '';
  if (!id || !title || !url || price === undefined || !currency) return null;
  return {
    id,
    title,
    shopName: clampText(fields.shopName, 100),
    price,
    currency,
    ...(isHttpsUrl(fields.imageUrl) ? { imageUrl: fields.imageUrl } : {}),
    url,
    ...(fields.shippingText ? { shippingText: clampText(fields.shippingText, 100) } : {}),
    ...(fields.conditionText ? { conditionText: clampText(fields.conditionText, 100) } : {}),
  };
}
