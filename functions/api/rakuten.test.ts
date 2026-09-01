import { describe, it, expect, vi, afterEach } from 'vitest';
import { onRequest } from './rakuten';

type MockInit = { status?: number; contentType?: string };

function upstreamJsonResponse(body: unknown, init: MockInit = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makeContext(overrides: {
  method?: string;
  search?: string;
  origin?: string;
  secFetchSite?: string;
  appId?: string;
}) {
  const url = `https://example.pages.dev/api/rakuten${overrides.search ?? ''}`;
  const headers = new Headers();
  if (overrides.origin !== undefined) headers.set('origin', overrides.origin);
  if (overrides.secFetchSite !== undefined) headers.set('sec-fetch-site', overrides.secFetchSite);
  const request = new Request(url, { method: overrides.method ?? 'GET', headers });
  return { request, env: { SERVER_RAKUTEN_APP_ID: overrides.appId } };
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe('functions/api/rakuten onRequest', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('GET以外は405を返す', async () => {
    const res = await onRequest(makeContext({ method: 'POST', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(405);
    const body = await readJson(res);
    expect(body.error).toBe('method_not_allowed');
  });

  it('同一オリジンでない Origin は403', async () => {
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', origin: 'https://evil.example.com', appId: 'key' }),
    );
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.error).toBe('forbidden_origin');
  });

  it('hostが同じでもschemeが異なるOriginは403（origin完全一致）', async () => {
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', origin: 'http://example.pages.dev', appId: 'key' }),
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('forbidden_origin');
  });

  it.each(['same-site', 'cross-site'])('Originが無くても Sec-Fetch-Site=%s は403', async (secFetchSite) => {
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', secFetchSite, appId: 'key' }),
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('forbidden_origin');
  });

  it('同一オリジンの Origin は許可される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ Items: [] }));
    const res = await onRequest(
      makeContext({
        method: 'GET',
        search: '?q=PS5',
        origin: 'https://example.pages.dev',
        secFetchSite: 'same-origin',
        appId: 'key',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('qが空の場合は400 invalid_query', async () => {
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=', appId: 'key' }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe('invalid_query');
  });

  it('qが制御文字だけの場合は400 invalid_query', async () => {
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=%0A%09', appId: 'key' }));
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('invalid_query');
  });

  it('qが100文字を超える場合は400 invalid_query', async () => {
    const longQuery = 'a'.repeat(101);
    const res = await onRequest(makeContext({ method: 'GET', search: `?q=${longQuery}`, appId: 'key' }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe('invalid_query');
  });

  it('キー未設定時は503 no_key を返し、Application ID を含まない', async () => {
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5' }));
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.error).toBe('no_key');
    expect(JSON.stringify(body)).not.toContain('SERVER_RAKUTEN_APP_ID');
  });

  it('空白だけのキーも未設定として503 no_key', async () => {
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: '   ' }));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('no_key');
  });

  it('limitは1〜30にクランプされる', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(upstreamJsonResponse({ Items: [] }));
    });
    await onRequest(makeContext({ method: 'GET', search: '?q=PS5&limit=999', appId: 'key' }));
    expect(new URL(capturedUrl).searchParams.get('hits')).toBe('30');

    await onRequest(makeContext({ method: 'GET', search: '?q=PS5&limit=0', appId: 'key' }));
    expect(new URL(capturedUrl).searchParams.get('hits')).toBe('1');
  });

  it('小数limitは整数へ切り捨て、非数値はデフォルト8件にする', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(upstreamJsonResponse({ Items: [] }));
    });

    await onRequest(makeContext({ method: 'GET', search: '?q=PS5&limit=3.9', appId: 'key' }));
    expect(new URL(capturedUrl).searchParams.get('hits')).toBe('3');

    await onRequest(makeContext({ method: 'GET', search: '?q=PS5&limit=abc', appId: 'key' }));
    expect(new URL(capturedUrl).searchParams.get('hits')).toBe('8');
  });

  it('上流が429の場合は429 rate_limited', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({}, { status: 429 }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(429);
    const body = await readJson(res);
    expect(body.error).toBe('rate_limited');
  });

  it('上流が4xxの場合は502 upstream_client_errorで詳細本文は透過しない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ secret: 'upstream detail' }, { status: 401 }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error).toBe('upstream_client_error');
    expect(body.upstreamStatus).toBe(401);
    expect(JSON.stringify(body)).not.toContain('upstream detail');
  });

  it('上流が5xxの場合は502 upstream_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({}, { status: 500 }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error).toBe('upstream_error');
  });

  it('上流のJSONが不正な形の場合は502 invalid_json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ notItems: true }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error).toBe('invalid_json');
  });

  it('fetch自体が失敗した場合は502 fetch_failedで内部例外やキーを返さない', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('socket failed: super-secret-app-id'));
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', appId: 'super-secret-app-id' }),
    );
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text).error).toBe('fetch_failed');
    expect(text).not.toContain('socket failed');
    expect(text).not.toContain('super-secret-app-id');
  });

  it('上流がタイムアウトした場合は504 timeout', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const promise = onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    await vi.advanceTimersByTimeAsync(8_000);
    const res = await promise;
    expect(res.status).toBe(504);
    const body = await readJson(res);
    expect(body.error).toBe('timeout');
  });

  it('http の商品URLはカードごと除外する', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:1',
              itemName: '安全な商品',
              shopName: 'shop',
              itemPrice: 1000,
              mediumImageUrls: [{ imageUrl: 'http://insecure.example.com/a.jpg' }],
              itemUrl: 'http://insecure.example.com/item',
              postageFlag: 0,
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items).toHaveLength(0);
  });

  it('商品名・ショップ名が最大長でクランプされる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:1',
              itemName: 'あ'.repeat(500),
              shopName: 'し'.repeat(500),
              itemPrice: 1000,
              mediumImageUrls: [],
              itemUrl: 'https://item.rakuten.co.jp/shop/1/',
              postageFlag: 0,
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items[0].itemName.length).toBeLessThanOrEqual(200);
    expect(body.items[0].shopName.length).toBeLessThanOrEqual(100);
  });

  it('必須識別子/商品名が欠けた壊れた商品はレスポンスから除外する', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          { Item: { itemCode: '', itemName: '名前だけ', itemPrice: 1000 } },
          { Item: { itemCode: 'shop:2', itemName: '', itemPrice: 1000 } },
          { Item: { itemCode: 'shop:3', itemName: '正常', itemPrice: 1500, mediumImageUrls: [], itemUrl: 'https://item.rakuten.co.jp/shop/3/' } },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].itemCode).toBe('shop:3');
    expect(body.items[0].itemPrice).toBe(1500);
  });

  it('https の商品URLが無い壊れた商品はレスポンスから除外する', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:http',
              itemName: 'HTTP商品',
              itemPrice: 1000,
              itemUrl: 'http://insecure.example.com/item',
            },
          },
          {
            Item: {
              itemCode: 'shop:ok',
              itemName: 'HTTPS商品',
              itemPrice: 2000,
              itemUrl: 'https://item.rakuten.co.jp/shop/ok/',
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].itemCode).toBe('shop:ok');
  });

  it('正常応答には items / source / status / requestId が含まれる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:1',
              itemName: 'PS5 本体',
              shopName: 'shop',
              itemPrice: 79800,
              mediumImageUrls: [{ imageUrl: 'https://example.com/a.jpg' }],
              itemUrl: 'https://item.rakuten.co.jp/shop/1/',
              postageFlag: 0,
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.source).toBe('official_api');
    expect(body.status).toBe('ok');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
    expect(body.items).toHaveLength(1);
  });

  it('成功/失敗レスポンスにno-storeとnosniffを付ける', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ Items: [] }));
    const ok = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const error = await onRequest(makeContext({ method: 'GET', search: '?q=', appId: 'key' }));

    for (const response of [ok, error]) {
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    }
  });

  it('レスポンスに Application ID の値が含まれない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ Items: [] }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'super-secret-app-id' }));
    const text = await res.clone().text();
    expect(text).not.toContain('super-secret-app-id');
  });

  it('不正価格の商品だけ除外し、正常商品は残して ¥0 へ変換しない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:ok1',
              itemName: '正常1',
              itemPrice: 79800,
              itemUrl: 'https://item.rakuten.co.jp/shop/ok1/',
            },
          },
          {
            Item: {
              itemCode: 'shop:undef',
              itemName: '価格なし',
              itemUrl: 'https://item.rakuten.co.jp/shop/undef/',
            },
          },
          {
            Item: {
              itemCode: 'shop:abc',
              itemName: '文字価格',
              itemPrice: 'abc',
              itemUrl: 'https://item.rakuten.co.jp/shop/abc/',
            },
          },
          {
            Item: {
              itemCode: 'shop:nan',
              itemName: 'NaN価格',
              itemPrice: Number.NaN,
              itemUrl: 'https://item.rakuten.co.jp/shop/nan/',
            },
          },
          {
            Item: {
              itemCode: 'shop:ok2',
              itemName: '正常2',
              itemPrice: 1200,
              itemUrl: 'https://item.rakuten.co.jp/shop/ok2/',
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.items.map((item: { itemCode: string }) => item.itemCode)).toEqual(['shop:ok1', 'shop:ok2']);
    expect(body.items.every((item: { itemPrice: number }) => item.itemPrice !== 0)).toBe(true);
  });

  it.each(['HEAD', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'] as const)(
    '%s は GET 以外として 405 method_not_allowed',
    async (method) => {
      const res = await onRequest(makeContext({ method, search: '?q=PS5', appId: 'key' }));
      expect(res.status).toBe(405);
      expect((await readJson(res)).error).toBe('method_not_allowed');
    },
  );

  it('q が重複する場合は先頭の値だけを使い、上流へ1キーワードだけ送る', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(upstreamJsonResponse({ Items: [] }));
    });
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5&q=Nintendo', appId: 'key' }));
    expect(res.status).toBe(200);
    expect(new URL(capturedUrl).searchParams.get('keyword')).toBe('PS5');
    expect(new URL(capturedUrl).searchParams.getAll('keyword')).toEqual(['PS5']);
  });

  it('Unicode / 絵文字の検索語はエンコードしたまま上流 keyword に渡す', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(upstreamJsonResponse({ Items: [] }));
    });
    const query = 'ＰＳ５🎮';
    const res = await onRequest(
      makeContext({ method: 'GET', search: `?q=${encodeURIComponent(query)}`, appId: 'key' }),
    );
    expect(res.status).toBe(200);
    expect(new URL(capturedUrl).searchParams.get('keyword')).toBe(query);
  });

  it('検索語に &applicationId= を混ぜても楽天の applicationId を上書きできない', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(upstreamJsonResponse({ Items: [] }));
    });
    const injected = 'PS5&applicationId=attacker-key&hits=1';
    await onRequest(
      makeContext({ method: 'GET', search: `?q=${encodeURIComponent(injected)}`, appId: 'real-app-id' }),
    );
    const upstream = new URL(capturedUrl);
    expect(upstream.searchParams.get('applicationId')).toBe('real-app-id');
    expect(upstream.searchParams.getAll('applicationId')).toEqual(['real-app-id']);
    expect(upstream.searchParams.get('keyword')).toBe(injected);
  });

  it('Origin: null は 403 forbidden_origin', async () => {
    const res = await onRequest(
      makeContext({ method: 'GET', search: '?q=PS5', origin: 'null', appId: 'key' }),
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('forbidden_origin');
  });

  it('formatVersion=2 のフラット Items もカード化する', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            itemCode: 'shop:flat',
            itemName: 'フラット商品',
            itemPrice: 3000,
            itemUrl: 'https://item.rakuten.co.jp/shop/flat/',
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].itemCode).toBe('shop:flat');
  });

  it('文字列の正当価格は数値化し、カンマ付き・指数表記の異常値は除外する', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:str',
              itemName: '文字価格',
              itemPrice: '79800',
              itemUrl: 'https://item.rakuten.co.jp/shop/str/',
            },
          },
          {
            Item: {
              itemCode: 'shop:comma',
              itemName: 'カンマ価格',
              itemPrice: '79,800',
              itemUrl: 'https://item.rakuten.co.jp/shop/comma/',
            },
          },
          {
            Item: {
              itemCode: 'shop:sci',
              itemName: '指数価格',
              itemPrice: 1e20,
              itemUrl: 'https://item.rakuten.co.jp/shop/sci/',
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items.map((item: { itemCode: string }) => item.itemCode)).toEqual(['shop:str']);
    expect(body.items[0].itemPrice).toBe(79800);
  });

  it('巨大な Items でも例外にせずキーを返さず、名前はクランプする', async () => {
    const bulky = Array.from({ length: 80 }, (_, index) => ({
      Item: {
        itemCode: `shop:${index}`,
        itemName: `商品${index}-${'あ'.repeat(400)}`,
        itemPrice: 1000 + index,
        itemUrl: `https://item.rakuten.co.jp/shop/${index}/`,
      },
    }));
    globalThis.fetch = vi.fn().mockResolvedValue(upstreamJsonResponse({ Items: bulky }));
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'super-secret-app-id' }));
    const text = await res.text();
    const body = JSON.parse(text) as { items: Array<{ itemName: string }> };
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(80);
    expect(body.items[0].itemName.length).toBeLessThanOrEqual(200);
    expect(text).not.toContain('super-secret-app-id');
  });

  it('上流200でも error フィールド付き JSON は契約不正として invalid_json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({ error: 'something-went-wrong', error_description: 'secret-detail' }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(res.status).toBe(502);
    expect(body.error).toBe('invalid_json');
    expect(JSON.stringify(body)).not.toContain('secret-detail');
  });

  it('正当な 0 円商品は残す', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      upstreamJsonResponse({
        Items: [
          {
            Item: {
              itemCode: 'shop:zero',
              itemName: '無料サンプル',
              itemPrice: 0,
              itemUrl: 'https://item.rakuten.co.jp/shop/zero/',
            },
          },
        ],
      }),
    );
    const res = await onRequest(makeContext({ method: 'GET', search: '?q=PS5', appId: 'key' }));
    const body = await readJson(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].itemPrice).toBe(0);
  });
});
