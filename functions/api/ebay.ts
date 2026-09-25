/**
 * `/api/ebay`: eBay Browse API（item_summary/search）のサーバーサイドプロキシ。
 *
 *  - Client ID / Client Secret（`SERVER_EBAY_CLIENT_ID` / `SERVER_EBAY_CLIENT_SECRET`）は Workers の Secret に置く。
 *  - OAuth のアプリ用トークン（client_credentials・スコープ `https://api.ebay.com/oauth/api_scope`）を取得し、
 *    有効期限の少し前まで Worker のメモリに保持して使い回す（検索のたびにトークンを取らない）。
 *  - 既定のマーケットは EBAY_US（価格は USD）。`SERVER_EBAY_MARKETPLACE_ID` で変更できる。
 *  - 応答は `market.ts` の共通形に正規化する。トークン・キー・上流の本文は返さない。
 *
 * 公式ドキュメント: https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
 */
import { checkSearchQuery } from '../../src/lib/searchQuery';
import { UpstreamTooLargeError, createRequestId, isSameOrigin, parseLimit, readTextCapped, resolveTestOverride } from './shared';
import { buildItem, marketError, marketSuccess, type NormalizedMarketItem } from './market';

export type EbayFunctionEnv = {
  SERVER_EBAY_CLIENT_ID?: string;
  SERVER_EBAY_CLIENT_SECRET?: string;
  SERVER_EBAY_MARKETPLACE_ID?: string;
  E2E_FAKE_UPSTREAM?: string;
  EBAY_API_BASE_OVERRIDE?: string;
  EBAY_OAUTH_URL_OVERRIDE?: string;
};

export const EBAY_SEARCH_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
export const EBAY_OAUTH_ENDPOINT = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 2_000_000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type CachedToken = { token: string; expiresAt: number; owner: string };
let cachedToken: CachedToken | null = null;

/** テスト用: 保持しているトークンを捨てる。 */
export function resetEbayTokenCache() {
  cachedToken = null;
}

class EbayAuthError extends Error {}

async function getAppToken(env: EbayFunctionEnv, clientId: string, clientSecret: string, signal: AbortSignal): Promise<string> {
  const owner = `${clientId}:${clientSecret.length}`;
  if (cachedToken && cachedToken.owner === owner && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const response = await fetch(resolveTestOverride(env, env.EBAY_OAUTH_URL_OVERRIDE, EBAY_OAUTH_ENDPOINT), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: EBAY_SCOPE }).toString(),
    signal,
  });
  if (!response.ok) {
    if (response.status >= 500) throw new Error('oauth_upstream_error');
    throw new EbayAuthError();
  }
  const data = JSON.parse(await readTextCapped(response, 50_000)) as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== 'string' || !data.access_token) throw new EbayAuthError();
  const lifetimeMs = (typeof data.expires_in === 'number' ? data.expires_in : 7200) * 1000;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + Math.max(lifetimeMs - TOKEN_REFRESH_MARGIN_MS, 60_000), owner };
  return data.access_token;
}

type EbaySummary = {
  itemId?: unknown;
  title?: unknown;
  price?: { value?: unknown; currency?: unknown };
  image?: { imageUrl?: unknown };
  thumbnailImages?: Array<{ imageUrl?: unknown }>;
  itemWebUrl?: unknown;
  condition?: unknown;
  seller?: { username?: unknown };
  shippingOptions?: Array<{ shippingCost?: { value?: unknown; currency?: unknown } }>;
};

function shippingText(summary: EbaySummary): string | undefined {
  const cost = summary.shippingOptions?.[0]?.shippingCost;
  if (!cost || cost.value === undefined) return undefined;
  const value = Number(cost.value);
  if (!Number.isFinite(value)) return undefined;
  if (value === 0) return '送料無料（米国内）';
  return `送料 ${String(cost.currency ?? '')} ${value.toFixed(2)}（米国内）`.replace('  ', ' ');
}

function normalizeSummary(summary: EbaySummary): NormalizedMarketItem | null {
  if (!summary || typeof summary !== 'object') return null;
  return buildItem({
    id: summary.itemId,
    title: summary.title,
    shopName: summary.seller?.username,
    price: summary.price?.value,
    currency: summary.price?.currency,
    imageUrl: summary.image?.imageUrl ?? summary.thumbnailImages?.[0]?.imageUrl,
    url: summary.itemWebUrl,
    shippingText: shippingText(summary),
    conditionText: typeof summary.condition === 'string' ? summary.condition : undefined,
  });
}

async function handleGet(request: Request, env: EbayFunctionEnv, requestId: string): Promise<Response> {
  if (!isSameOrigin(request)) return marketError('forbidden_origin', 403, requestId);

  const url = new URL(request.url);
  const check = checkSearchQuery(url.searchParams.get('q') ?? '');
  if (!check.ok) return marketError('invalid_query', 400, requestId);
  const limit = parseLimit(url.searchParams.get('limit'), { min: 1, max: 30, fallback: 8 });

  const clientId = env.SERVER_EBAY_CLIENT_ID?.trim();
  const clientSecret = env.SERVER_EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return marketError('no_key', 503, requestId);
  const marketplace = /^EBAY_[A-Z]{2,3}$/.test(env.SERVER_EBAY_MARKETPLACE_ID?.trim() ?? '')
    ? (env.SERVER_EBAY_MARKETPLACE_ID as string).trim()
    : 'EBAY_US';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    let token: string;
    try {
      token = await getAppToken(env, clientId, clientSecret, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) throw err;
      if (err instanceof EbayAuthError) return marketError('upstream_auth', 502, requestId);
      return marketError('upstream_error', 502, requestId);
    }

    const endpoint = new URL(resolveTestOverride(env, env.EBAY_API_BASE_OVERRIDE, EBAY_SEARCH_ENDPOINT));
    endpoint.searchParams.set('q', check.value);
    endpoint.searchParams.set('limit', String(limit));
    const upstream = await fetch(endpoint.toString(), {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        'x-ebay-c-marketplace-id': marketplace,
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      if (upstream.status === 401) cachedToken = null; // トークン失効。次回は取り直す
      if (upstream.status === 429) return marketError('rate_limited', 429, requestId, upstream.status);
      if (upstream.status >= 500) return marketError('upstream_error', 502, requestId, upstream.status);
      if (upstream.status === 401 || upstream.status === 403) return marketError('upstream_auth', 502, requestId, upstream.status);
      return marketError('upstream_client_error', 502, requestId, upstream.status);
    }

    let data: unknown;
    try {
      data = JSON.parse(await readTextCapped(upstream, MAX_UPSTREAM_BYTES));
    } catch (err) {
      if (controller.signal.aborted) throw err;
      if (err instanceof UpstreamTooLargeError) return marketError('upstream_error', 502, requestId);
      return marketError('invalid_json', 502, requestId);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return marketError('invalid_json', 502, requestId);
    const record = data as { itemSummaries?: unknown; total?: unknown };
    // 0件のときは itemSummaries 自体が無い（total: 0）。
    if (record.itemSummaries === undefined && typeof record.total === 'number') return marketSuccess([], requestId);
    if (!Array.isArray(record.itemSummaries)) return marketError('invalid_json', 502, requestId);
    const items = record.itemSummaries
      .map((summary) => normalizeSummary(summary as EbaySummary))
      .filter((item): item is NormalizedMarketItem => Boolean(item));
    return marketSuccess(items, requestId);
  } catch (err) {
    const isAbort = controller.signal.aborted || (err as { name?: string } | undefined)?.name === 'AbortError';
    return marketError(isAbort ? 'timeout' : 'fetch_failed', isAbort ? 504 : 502, requestId);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onEbayRequest({ request, env }: { request: Request; env: EbayFunctionEnv }): Promise<Response> {
  const requestId = createRequestId();
  if (request.method !== 'GET') return marketError('method_not_allowed', 405, requestId);
  return handleGet(request, env, requestId);
}
