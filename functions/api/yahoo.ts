/**
 * `/api/yahoo`: Yahoo!ショッピング 商品検索API（v3）のサーバーサイドプロキシ。
 *
 *  - Client ID（`SERVER_YAHOO_CLIENT_ID`）は Workers の Secret に置き、ブラウザには出さない。
 *  - 8桁・13桁の数字は JAN コードとして `jan_code` で検索する（型番・商品名は `query`）。
 *  - 公式の上限は約1秒1回。超過時の 429 は `rate_limited` として返す。
 *  - 応答は `market.ts` の共通形（NormalizedMarketItem）に正規化する。上流の本文・キーは返さない。
 *
 * 公式ドキュメント: https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html
 * クレジット表記（必須）: 画面下部の「Webサービス by Yahoo! JAPAN」（AppShell.tsx）
 */
import { checkSearchQuery, isJanCode } from '../../src/lib/searchQuery';
import { UpstreamTooLargeError, createRequestId, isSameOrigin, parseLimit, readTextCapped, resolveTestOverride } from './shared';
import { buildItem, marketError, marketSuccess, type NormalizedMarketItem } from './market';

export type YahooFunctionEnv = {
  SERVER_YAHOO_CLIENT_ID?: string;
  E2E_FAKE_UPSTREAM?: string;
  YAHOO_API_BASE_OVERRIDE?: string;
};

export const YAHOO_ENDPOINT = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch';
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 2_000_000;

export function resolveYahooEndpoint(env: YahooFunctionEnv): string {
  return resolveTestOverride(env, env.YAHOO_API_BASE_OVERRIDE, YAHOO_ENDPOINT);
}

type YahooHit = {
  code?: unknown;
  name?: unknown;
  url?: unknown;
  price?: unknown;
  image?: { medium?: unknown; small?: unknown };
  seller?: { name?: unknown };
  shipping?: { name?: unknown };
  condition?: unknown;
  inStock?: unknown;
};

function normalizeHit(hit: YahooHit): NormalizedMarketItem | null {
  if (!hit || typeof hit !== 'object') return null;
  if (hit.inStock === false) return null; // 売り切れは相場比較に使わない
  const shipping = typeof hit.shipping?.name === 'string' ? hit.shipping.name : undefined;
  const condition = hit.condition === 'used' ? '中古' : hit.condition === 'new' ? '新品' : undefined;
  return buildItem({
    id: hit.code,
    title: hit.name,
    shopName: hit.seller?.name,
    price: hit.price,
    currency: 'JPY',
    imageUrl: hit.image?.medium ?? hit.image?.small,
    url: hit.url,
    shippingText: shipping,
    conditionText: condition,
  });
}

async function handleGet(request: Request, env: YahooFunctionEnv, requestId: string): Promise<Response> {
  if (!isSameOrigin(request)) return marketError('forbidden_origin', 403, requestId);

  const url = new URL(request.url);
  const check = checkSearchQuery(url.searchParams.get('q') ?? '');
  if (!check.ok) return marketError('invalid_query', 400, requestId);
  const limit = parseLimit(url.searchParams.get('limit'), { min: 1, max: 30, fallback: 8 });

  const clientId = env.SERVER_YAHOO_CLIENT_ID?.trim();
  if (!clientId) return marketError('no_key', 503, requestId);

  const endpoint = new URL(resolveYahooEndpoint(env));
  endpoint.searchParams.set('appid', clientId);
  if (isJanCode(check.value)) endpoint.searchParams.set('jan_code', check.value);
  else endpoint.searchParams.set('query', check.value);
  endpoint.searchParams.set('results', String(limit));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(endpoint.toString(), {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return marketError('rate_limited', 429, requestId, upstream.status);
      if (upstream.status >= 500) return marketError('upstream_error', 502, requestId, upstream.status);
      if (upstream.status === 401 || upstream.status === 403) return marketError('upstream_auth', 502, requestId, upstream.status);
      let message = '';
      try {
        message = (await readTextCapped(upstream, 10_000)).toLowerCase();
      } catch (err) {
        if (controller.signal.aborted) throw err;
      }
      if (/appid|client|application/.test(message)) return marketError('upstream_auth', 502, requestId, upstream.status);
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

    const hits = data && typeof data === 'object' && !Array.isArray(data) ? (data as { hits?: unknown }).hits : undefined;
    if (!Array.isArray(hits)) return marketError('invalid_json', 502, requestId);
    const items = hits.map((hit) => normalizeHit(hit as YahooHit)).filter((item): item is NormalizedMarketItem => Boolean(item));
    return marketSuccess(items, requestId);
  } catch (err) {
    const isAbort = controller.signal.aborted || (err as { name?: string } | undefined)?.name === 'AbortError';
    return marketError(isAbort ? 'timeout' : 'fetch_failed', isAbort ? 504 : 502, requestId);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onYahooRequest({ request, env }: { request: Request; env: YahooFunctionEnv }): Promise<Response> {
  const requestId = createRequestId();
  if (request.method !== 'GET') return marketError('method_not_allowed', 405, requestId);
  return handleGet(request, env, requestId);
}
