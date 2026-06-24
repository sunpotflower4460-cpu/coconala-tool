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
 *
 * 利用:
 *  - GET /api/rakuten?q=<キーワード>&limit=<件数>
 *  - キー未設定時は 503 + { error: 'no_key' } を返し、フロント側はモックへフォールバックする。
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** 楽天 formatVersion=2 / 旧形式どちらの画像配列でも文字列URLへ正規化する。 */
function normalizeImageUrls(value: unknown): Array<{ imageUrl: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return { imageUrl: entry };
      if (entry && typeof entry === 'object' && 'imageUrl' in entry) {
        return { imageUrl: String((entry as { imageUrl: unknown }).imageUrl) };
      }
      return undefined;
    })
    .filter((entry): entry is { imageUrl: string } => Boolean(entry?.imageUrl));
}

function normalizeItem(raw: Record<string, unknown>): NormalizedItem {
  return {
    itemCode: String(raw.itemCode ?? ''),
    itemName: String(raw.itemName ?? ''),
    shopName: String(raw.shopName ?? ''),
    itemPrice: Number(raw.itemPrice ?? 0),
    mediumImageUrls: normalizeImageUrls(raw.mediumImageUrls),
    itemUrl: String(raw.itemUrl ?? ''),
    postageFlag: Number(raw.postageFlag) === 0 ? 0 : 1,
  };
}

export const onRequestGet = async (context: PagesFunctionContext): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 8, 1), MAX_LIMIT);

  if (!query) {
    return jsonResponse({ error: 'missing_query', items: [] }, 400);
  }

  const appId = env.SERVER_RAKUTEN_APP_ID;
  if (!appId) {
    // キー未設定: フロントはモックにフォールバックする。キー文字列は一切返さない。
    return jsonResponse({ error: 'no_key', items: [] }, 503);
  }

  const endpoint = new URL(RAKUTEN_ENDPOINT);
  endpoint.searchParams.set('applicationId', appId);
  endpoint.searchParams.set('keyword', query);
  endpoint.searchParams.set('hits', String(limit));
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('formatVersion', '2');

  try {
    const upstream = await fetch(endpoint.toString(), {
      headers: { accept: 'application/json' },
    });

    if (!upstream.ok) {
      return jsonResponse({ error: 'upstream_error', status: upstream.status, items: [] }, 502);
    }

    const data = (await upstream.json()) as { Items?: unknown };
    const rawItems = Array.isArray(data.Items) ? data.Items : [];
    const items = rawItems
      .map((entry) => {
        // formatVersion=2 は item が直接、旧形式は { Item: {...} }。
        const record =
          entry && typeof entry === 'object' && 'Item' in (entry as Record<string, unknown>)
            ? ((entry as { Item: Record<string, unknown> }).Item ?? {})
            : (entry as Record<string, unknown>);
        return normalizeItem(record ?? {});
      })
      .filter((item) => item.itemCode && item.itemName);

    return jsonResponse({ items, source: 'official_api' });
  } catch {
    return jsonResponse({ error: 'fetch_failed', items: [] }, 502);
  }
};
