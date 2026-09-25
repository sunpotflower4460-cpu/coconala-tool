/**
 * `/api/rakuten`: 楽天市場 商品検索API のサーバーサイドプロキシ（Cloudflare Workers の `worker.ts` から呼ばれる）。
 *
 * 目的:
 *  - 楽天のアプリID・アクセスキーをブラウザに露出させずに楽天APIを呼ぶ。
 *  - レスポンスにキーを含めない。必要なフィールドだけを返す。
 *
 * 楽天API（2026年〜の新API）:
 *  - エンドポイントは `openapi.rakuten.co.jp`。旧 `app.rakuten.co.jp` は 2026-05-14 に提供終了。
 *  - `applicationId` と `accessKey` の両方が必須。
 *  - 楽天側のアプリ設定「許可されたWebサイト」と一致する Origin / Referer を送る。
 *
 * セキュリティ:
 *  - キーは Workers の Secret（`wrangler secret put`）に設定する。`VITE_` 変数には絶対に置かない。
 *  - GET 以外は 405。検索語は `checkRakutenSearchQuery` の規則で検証。`limit` は整数 1〜30 に固定。
 *  - Origin ヘッダーが付いている場合は完全な origin（scheme/host/port）が自ホストと一致する場合のみ許可する。
 *    ブラウザの Sec-Fetch-Site が same-site / cross-site の場合も拒否する。
 *  - 上流通信は本文の読み取りまで含めて約8秒でタイムアウト。本文サイズにも上限を設ける。
 *  - 内部例外・キー・上流の本文はクライアントへ返さない。
 *
 * 利用:
 *  - GET /api/rakuten?q=<キーワード>&limit=<件数>
 *  - キー未設定時は 503 + { error: 'no_key' } を返し、フロント側はモックへフォールバックする。
 *
 * レスポンス形（成功・失敗とも共通の封筒）:
 *  { items: NormalizedItem[], source: 'official_api', status: 'ok' | 'error', requestId: string, error?: string, upstreamStatus?: number }
 */

import { checkRakutenSearchQuery } from '../../src/lib/searchQuery';
import {
  API_SECURITY_HEADERS,
  RESPONSE_HEADERS,
  UpstreamTooLargeError,
  clampText,
  createRequestId,
  isHttpsUrl,
  isSameOrigin,
  parseLimit,
  readTextCapped,
  resolveTestOverride,
} from './shared';

export { API_SECURITY_HEADERS };

export type RakutenFunctionEnv = {
  SERVER_RAKUTEN_APP_ID?: string;
  SERVER_RAKUTEN_ACCESS_KEY?: string;
  /** 楽天のアプリ設定に登録したサイトURL（例: https://example.workers.dev）。未設定ならリクエスト自身の origin を使う。 */
  SERVER_RAKUTEN_ALLOWED_ORIGIN?: string;
  /** E2E 専用。`E2E_FAKE_UPSTREAM=1` かつループバックのURLのときだけ上流を差し替える。本番では無視される。 */
  E2E_FAKE_UPSTREAM?: string;
  RAKUTEN_API_BASE_OVERRIDE?: string;
};

type PagesFunctionContext = {
  request: Request;
  env: RakutenFunctionEnv;
};

export const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701';
const UPSTREAM_TIMEOUT_MS = 8_000;
/** 30件 × 画像3枚でも数百KB。これを超える応答は異常とみなして読まない。 */
export const MAX_UPSTREAM_BYTES = 2_000_000;
const MAX_TEXT_LENGTH = 200;
const MAX_SHOP_NAME_LENGTH = 100;

/** フロントの rakutenMapper が期待する最小フィールド形へ正規化する。 */
type NormalizedItem = {
  itemCode: string;
  itemName: string;
  shopName: string;
  itemPrice: number;
  mediumImageUrls: Array<{ imageUrl: string }>;
  itemUrl: string;
  postageFlag: 0 | 1;
};

export type ErrorCode =
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

function successResponse(items: NormalizedItem[], requestId: string): Response {
  return new Response(JSON.stringify({ items, source: 'official_api', status: 'ok', requestId }), {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}

export function errorResponse(
  error: ErrorCode,
  httpStatus: number,
  requestId: string = createRequestId(),
  upstreamStatus?: number,
): Response {
  return new Response(
    JSON.stringify({
      items: [],
      source: 'official_api',
      status: 'error',
      error,
      requestId,
      ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
    }),
    {
      status: httpStatus,
      headers: RESPONSE_HEADERS,
    },
  );
}

/** 楽天 formatVersion=2 / 旧形式どちらの画像配列でも、https の文字列URLのみへ正規化する。 */
function normalizeImageUrls(value: unknown): Array<{ imageUrl: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const url = typeof entry === 'string' ? entry : (entry as { imageUrl?: unknown })?.imageUrl;
      return isHttpsUrl(url) ? { imageUrl: url } : undefined;
    })
    .filter((entry): entry is { imageUrl: string } => Boolean(entry));
}

const MAX_ITEM_PRICE = 100_000_000;

/**
 * 楽天 itemPrice を採用してよい値だけ返す。不正値は 0 へ変換せず捨てる。
 * 正当な 0 円は 0 のまま残す。
 */
function parseItemPrice(value: unknown): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > MAX_ITEM_PRICE) return undefined;
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_ITEM_PRICE) return undefined;
    return parsed;
  }
  return undefined;
}

function normalizeItem(raw: Record<string, unknown>): NormalizedItem | null {
  const itemCode = clampText(raw.itemCode, MAX_TEXT_LENGTH);
  const itemName = clampText(raw.itemName, MAX_TEXT_LENGTH);
  const itemUrl = isHttpsUrl(raw.itemUrl) ? raw.itemUrl : '';
  const itemPrice = parseItemPrice(raw.itemPrice);
  if (!itemCode || !itemName || !itemUrl || itemPrice === undefined) return null;

  return {
    itemCode,
    itemName,
    shopName: clampText(raw.shopName, MAX_SHOP_NAME_LENGTH),
    itemPrice,
    mediumImageUrls: normalizeImageUrls(raw.mediumImageUrls),
    itemUrl,
    postageFlag: Number(raw.postageFlag) === 0 ? 0 : 1,
  };
}

/** 楽天APIの応答から商品配列を取り出す。`Items`（従来）/ `items`（新ドキュメント表記）の両方を受け付ける。 */
function extractItems(value: unknown): unknown[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { Items?: unknown; items?: unknown };
  if (Array.isArray(record.Items)) return record.Items;
  if (Array.isArray(record.items)) return record.items;
  return null;
}

/** 上流URL。E2E の偽楽天サーバーはフラグ付き・ループバック限定でのみ使い、本番設定では絶対に効かない。 */
export function resolveRakutenEndpoint(env: RakutenFunctionEnv): string {
  return resolveTestOverride(env, env.RAKUTEN_API_BASE_OVERRIDE, RAKUTEN_ENDPOINT);
}

/** 楽天に送る Origin。設定値が不正ならリクエスト自身の origin を使う。 */
function resolveUpstreamOrigin(env: RakutenFunctionEnv, request: Request): string {
  const configured = env.SERVER_RAKUTEN_ALLOWED_ORIGIN?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // 不正な設定値は無視する
    }
  }
  return new URL(request.url).origin;
}

/** 楽天のエラー本文（`{ error, error_description }`）から、利用者へ出す分類だけを取り出す。本文そのものは返さない。 */
async function classifyUpstreamClientError(
  response: Response,
  signal: AbortSignal,
): Promise<'invalid_query' | 'upstream_auth' | 'upstream_client_error'> {
  if (response.status === 401 || response.status === 403) return 'upstream_auth';
  let description = '';
  try {
    const body = JSON.parse(await readTextCapped(response, 10_000)) as { error?: unknown; error_description?: unknown };
    description = `${String(body.error ?? '')} ${String(body.error_description ?? '')}`.toLowerCase();
  } catch (err) {
    // 本文の読み取り中にタイムアウトした場合は、呼び出し元で timeout として扱う。
    if (signal.aborted) throw err;
    return 'upstream_client_error';
  }
  if (/keyword/.test(description)) return 'invalid_query';
  if (/application|access\s*key|accesskey|referer|referrer|origin|unauthori|forbidden|not allowed/.test(description)) {
    return 'upstream_auth';
  }
  return 'upstream_client_error';
}

async function handleGet(context: PagesFunctionContext, requestId: string): Promise<Response> {
  const { request, env } = context;

  if (!isSameOrigin(request)) {
    return errorResponse('forbidden_origin', 403, requestId);
  }

  const url = new URL(request.url);
  const queryCheck = checkRakutenSearchQuery(url.searchParams.get('q') ?? '');
  const limit = parseLimit(url.searchParams.get('limit'));

  if (!queryCheck.ok) {
    return errorResponse('invalid_query', 400, requestId);
  }

  const appId = env.SERVER_RAKUTEN_APP_ID?.trim();
  const accessKey = env.SERVER_RAKUTEN_ACCESS_KEY?.trim();
  if (!appId || !accessKey) {
    // キー未設定（どちらか欠けても不可）: フロントはモックにフォールバックする。キー文字列は一切返さない。
    return errorResponse('no_key', 503, requestId);
  }

  const endpoint = new URL(resolveRakutenEndpoint(env));
  endpoint.searchParams.set('applicationId', appId);
  endpoint.searchParams.set('accessKey', accessKey);
  endpoint.searchParams.set('keyword', queryCheck.keyword);
  endpoint.searchParams.set('hits', String(limit));
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('formatVersion', '2');

  const upstreamOrigin = resolveUpstreamOrigin(env, request);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint.toString(), {
      headers: {
        accept: 'application/json',
        origin: upstreamOrigin,
        referer: `${upstreamOrigin}/`,
      },
      signal: controller.signal,
    });

    // 楽天は「該当なし」を 404 not_found で返すことがある。通信失敗ではなく 0 件として扱う。
    if (upstream.status === 404) return successResponse([], requestId);

    if (!upstream.ok) {
      if (upstream.status === 429) return errorResponse('rate_limited', 429, requestId, upstream.status);
      if (upstream.status >= 500) return errorResponse('upstream_error', 502, requestId, upstream.status);
      const kind = await classifyUpstreamClientError(upstream, controller.signal);
      if (kind === 'invalid_query') return errorResponse('invalid_query', 400, requestId, upstream.status);
      return errorResponse(kind, 502, requestId, upstream.status);
    }

    let data: unknown;
    try {
      data = JSON.parse(await readTextCapped(upstream, MAX_UPSTREAM_BYTES));
    } catch (err) {
      if (controller.signal.aborted) throw err;
      if (err instanceof UpstreamTooLargeError) return errorResponse('upstream_error', 502, requestId);
      return errorResponse('invalid_json', 502, requestId);
    }

    const rawItems = extractItems(data);
    if (!rawItems) {
      return errorResponse('invalid_json', 502, requestId);
    }

    const items = rawItems
      .map((entry) => {
        // formatVersion=2 は item が直接、旧形式は { Item: {...} }。
        const nested =
          entry && typeof entry === 'object' && 'Item' in (entry as Record<string, unknown>)
            ? (entry as { Item: unknown }).Item
            : entry;
        const record =
          nested && typeof nested === 'object' && !Array.isArray(nested)
            ? (nested as Record<string, unknown>)
            : {};
        return normalizeItem(record);
      })
      .filter((item): item is NormalizedItem => Boolean(item));

    return successResponse(items, requestId);
  } catch (err) {
    const isAbort = controller.signal.aborted || (err as { name?: string } | undefined)?.name === 'AbortError';
    return errorResponse(isAbort ? 'timeout' : 'fetch_failed', isAbort ? 504 : 502, requestId);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const onRequest = async (context: PagesFunctionContext): Promise<Response> => {
  const requestId = createRequestId();
  if (context.request.method !== 'GET') {
    return errorResponse('method_not_allowed', 405, requestId);
  }
  return handleGet(context, requestId);
};
