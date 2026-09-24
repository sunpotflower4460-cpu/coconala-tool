#!/usr/bin/env node
/**
 * E2E 専用の「偽の楽天市場 商品検索API」。
 *
 * 公式ドキュメント（IchibaItem/Search/20260701）の契約に合わせて応答する:
 *  - パス: /ichibams/api/IchibaItem/Search/20260701
 *  - applicationId と accessKey の両方が必須（欠けたら 400 wrong_parameter）
 *  - formatVersion=2 のフラットな Items 配列
 *
 * 検索語（keyword）でシナリオを切り替え、実 Worker 経由の全経路（成功・0件・各種障害）を再現する。
 *   __429 / __500 / __503 / __401 / __403 / __404 / __400key / __400app / __slow / __html / __badjson / __big / __error200 / __empty
 *   それ以外 → 通常の商品3件（検索語を商品名に含める）
 *
 * 受信したリクエストは GET /__requests で確認できる（キーが上流に届いたか・hits の正規化など）。
 * 127.0.0.1 だけで待ち受け、外部からは到達できない。
 */
import http from 'node:http';

const PORT = Number(process.env.FAKE_RAKUTEN_PORT ?? 43174);
const API_PATH = '/ichibams/api/IchibaItem/Search/20260701';
const requests = [];

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function items(keyword, count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    itemCode: `e2e-shop:item-${i + 1}`,
    itemName: `【E2E実データ】${keyword} 商品${i + 1}`,
    itemPrice: 10000 + i * 1500,
    itemUrl: `https://item.rakuten.co.jp/e2e-shop/item-${i + 1}/`,
    shopName: `E2Eショップ${i + 1}`,
    mediumImageUrls: [`https://thumbnail.image.rakuten.co.jp/e2e/item-${i + 1}.jpg`],
    postageFlag: i % 2,
  }));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/__health') return json(res, 200, { ok: true });
  if (url.pathname === '/__requests') return json(res, 200, requests);
  if (url.pathname === '/__reset') {
    requests.length = 0;
    return json(res, 200, { ok: true });
  }
  if (url.pathname !== API_PATH) return json(res, 404, { error: 'not_found', error_description: 'unknown path' });

  const keyword = url.searchParams.get('keyword') ?? '';
  requests.push({
    keyword,
    applicationId: url.searchParams.get('applicationId'),
    accessKey: url.searchParams.get('accessKey'),
    hits: url.searchParams.get('hits'),
    formatVersion: url.searchParams.get('formatVersion'),
    origin: req.headers.origin ?? null,
    referer: req.headers.referer ?? null,
  });
  if (requests.length > 500) requests.shift();

  if (!url.searchParams.get('applicationId') || !url.searchParams.get('accessKey')) {
    return json(res, 400, { error: 'wrong_parameter', error_description: 'specify valid applicationId and accessKey' });
  }

  switch (keyword.split(' ')[0]) {
    case '__429':
      return json(res, 429, { error: 'too_many_requests', error_description: 'number of allowed requests has been exceeded' });
    case '__500':
      return json(res, 500, { error: 'system_error', error_description: 'api logic error' });
    case '__503':
      return json(res, 503, { error: 'service_unavailable', error_description: 'maintenance' });
    case '__401':
      return json(res, 401, { error: 'invalid_access_key', error_description: 'accessKey is not valid' });
    case '__403':
      return json(res, 403, { error: 'forbidden', error_description: 'Referer or Origin is not allowed' });
    case '__404':
      return json(res, 404, { error: 'not_found', error_description: 'not found' });
    case '__400key':
      return json(res, 400, { error: 'wrong_parameter', error_description: 'keyword parameter is not valid' });
    case '__400app':
      return json(res, 400, { error: 'wrong_parameter', error_description: 'specify valid applicationId' });
    case '__slow':
      // Worker の上流タイムアウト（8秒）より長く待たせる。
      setTimeout(() => json(res, 200, { Items: items(keyword) }), 9_500);
      return undefined;
    case '__html':
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<!doctype html><title>maintenance</title>');
    case '__badjson':
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"Items": [');
    case '__big':
      return json(res, 200, { Items: items(keyword, 30), padding: 'x'.repeat(2_500_000) });
    case '__error200':
      return json(res, 200, { error: 'unexpected', error_description: 'contract changed' });
    case '__empty':
      return json(res, 200, { Items: [], count: 0, page: 1 });
    default:
      return json(res, 200, { Items: items(keyword, Math.min(3, Number(url.searchParams.get('hits') ?? 3))), count: 3, page: 1 });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fake-rakuten] listening on http://127.0.0.1:${PORT}${API_PATH}`);
});
