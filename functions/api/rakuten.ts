/**
 * Cloudflare Pages Function: 楽天市場 商品検索API のサーバーサイドプロキシ。
 *
 * 目的:
 *  - 楽天 Application ID（`SERVER_RAKUTEN_APP_ID`）をブラウザに露出させずに楽天APIを呼ぶ。
 *  - レスポンスにキーを含めない。必要なフィールドだけを返す。
 *
 * セキュリティ:
 *  - `SERVER_RAKUTEN_APP_ID` は Cloudflare Pages の環境変数（暗号化）に設定する。
 *  - `VITE_` プレフィックスのフロント変数には絶対に置かない。
 *  - GET 以外は 405。`q` は trim 後 1〜100文字、制御文字は除去。`limit` は 1〜30 に固定。
 *  - Origin ヘッダーが付いていて、かつ自ホストと異なる場合は 403（同一オリジン運用が基本）。
 *  - 上流通信には約8秒のタイムアウトを設定し、内部例外・Application ID をクライアントへ返さない。
 *
 * 利用:
 *  - GET /api/rakuten?q=<キーワード>&limit=<件数>
 *  - キー未設定時は 503 + { error: 'no_key' } を返し、フロント側はモックへフォールバックする。
 *
 * レスポンス形（成功・失敗とも共通の封筒）:
 *  { items: NormalizedItem[], source: 'official_api', status: 'ok' | 'error', requestId: string, error?: string, upstreamStatus?: number }
 */

interface Env {
  SERVER_RAKUTEN_APP_ID?: string;
}

type PagesFunctionContext = {
  request: Request;
  env: Env;
};

const RAKUTEN_ENDPOINT = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
const MAX_LIMIT = 30;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 8;
const MAX_QUERY_LENGTH = 100;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_TEXT_LENGTH = 200;
const MAX_SHOP_NAME_LENGTH = 100;
const MAX_URL_LENGTH = 2000;

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

type ErrorCode =
  | 'method_not_allowed'
  | 'forbidden_origin'
  | 'invalid_query'
  | 'no_key'
  | 'rate_limited'
  | 'upstream_client_error'
  | 'upstream_error'
  | 'invalid_json'
  | 'timeout'
  | 'fetch_failed';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function successResponse(items: NormalizedItem[], requestId: string): Response {
  return new Response(JSON.stringify({ items, source: 'official_api', status: 'ok', requestId }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function errorResponse(
  error: ErrorCode,
  httpStatus: number,
  requestId: string,
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
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
}

/** 制御文字（タブ・改行含む）を取り除く。 */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '');
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return stripControlChars(value).slice(0, maxLength);
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

function normalizeItem(raw: Record<string, unknown>): NormalizedItem {
  const itemUrl = raw.itemUrl;
  return {
    itemCode: clampText(raw.itemCode, MAX_TEXT_LENGTH),
    itemName: clampText(raw.itemName, MAX_TEXT_LENGTH),
    shopName: clampText(raw.shopName, MAX_SHOP_NAME_LENGTH),
    itemPrice: Number.isFinite(Number(raw.itemPrice)) ? Math.max(0, Number(raw.itemPrice)) : 0,
    mediumImageUrls: normalizeImageUrls(raw.mediumImageUrls),
    itemUrl: isHttpsUrl(itemUrl) ? itemUrl : '',
    postageFlag: Number(raw.postageFlag) === 0 ? 0 : 1,
  };
}

/** 楽天APIの応答が期待する最低限の形（`Items` 配列）を持つかどうかの型ガード。 */
function isRakutenSearchPayload(value: unknown): value is { Items: unknown[] } {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as { Items?: unknown }).Items);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Origin 未送信（非ブラウザ・同一オリジンGET等）は許可する。
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function handleGet(context: PagesFunctionContext, requestId: string): Promise<Response> {
  const { request, env } = context;

  if (!isSameOrigin(request)) {
    return errorResponse('forbidden_origin', 403, requestId);
  }

  const url = new URL(request.url);
  const rawQuery = stripControlChars((url.searchParams.get('q') ?? '').trim());
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MIN_LIMIT), MAX_LIMIT);

  if (!rawQuery || rawQuery.length > MAX_QUERY_LENGTH) {
    return errorResponse('invalid_query', 400, requestId);
  }

  const appId = env.SERVER_RAKUTEN_APP_ID;
  if (!appId) {
    // キー未設定: フロントはモックにフォールバックする。キー文字列は一切返さない。
    return errorResponse('no_key', 503, requestId);
  }

  const endpoint = new URL(RAKUTEN_ENDPOINT);
  endpoint.searchParams.set('applicationId', appId);
  endpoint.searchParams.set('keyword', rawQuery);
  endpoint.searchParams.set('hits', String(limit));
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('formatVersion', '2');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint.toString(), {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return errorResponse('rate_limited', 429, requestId, upstream.status);
      if (upstream.status >= 500) return errorResponse('upstream_error', 502, requestId, upstream.status);
      return errorResponse('upstream_client_error', 502, requestId, upstream.status);
    }

    let data: unknown;
    try {
      data = await upstream.json();
    } catch {
      return errorResponse('invalid_json', 502, requestId);
    }

    if (!isRakutenSearchPayload(data)) {
      return errorResponse('invalid_json', 502, requestId);
    }

    const items = data.Items.map((entry) => {
      // formatVersion=2 は item が直接、旧形式は { Item: {...} }。
      const record =
        entry && typeof entry === 'object' && 'Item' in (entry as Record<string, unknown>)
          ? ((entry as { Item: Record<string, unknown> }).Item ?? {})
          : (entry as Record<string, unknown>);
      return normalizeItem(record ?? {});
    }).filter((item) => item.itemCode && item.itemName);

    return successResponse(items, requestId);
  } catch (err) {
    const isAbort = (err as { name?: string } | undefined)?.name === 'AbortError';
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
