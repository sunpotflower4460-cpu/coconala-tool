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
 * Yahoo!ショッピング（/ShoppingWebService/V3/itemSearch）と eBay（OAuth・/buy/browse/v1/item_summary/search）も
 * 公式の応答形で返す。まとめて検索の部分失敗を再現する目印:
 *   __yahoofail（Yahoo!だけ 500）/ __ebayauth（eBayだけ 401）/ __allfail（3サイトとも 500）
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

const YAHOO_PATH = '/ShoppingWebService/V3/itemSearch';
const EBAY_OAUTH_PATH = '/identity/v1/oauth2/token';
const EBAY_SEARCH_PATH = '/buy/browse/v1/item_summary/search';

function handleYahoo(url, res) {
  const query = url.searchParams.get('query') ?? url.searchParams.get('jan_code') ?? '';
  requests.push({ source: 'yahoo', keyword: query, appid: url.searchParams.get('appid'), results: url.searchParams.get('results') });
  if (!url.searchParams.get('appid')) return json(res, 400, { Error: { Message: 'appid is required' } });
  if (query.startsWith('__allfail') || query.startsWith('__yahoofail')) return json(res, 500, { Error: { Message: 'down' } });
  if (query.startsWith('__empty')) return json(res, 200, { totalResultsAvailable: 0, hits: [] });
  const hits = Array.from({ length: 3 }, (_, i) => ({
    code: `e2e-yahoo_item-${i + 1}`,
    name: `【E2E Yahoo】${query} 商品${i + 1}`,
    url: `https://store.shopping.yahoo.co.jp/e2e-store/item-${i + 1}.html`,
    price: 9000 + i * 2000,
    image: { medium: `https://item-shopping.c.yimg.jp/i/g/e2e-${i + 1}` },
    seller: { name: `E2Eストア${i + 1}` },
    shipping: { name: i === 0 ? '送料無料' : '送料別' },
    condition: i === 2 ? 'used' : 'new',
    inStock: true,
  }));
  return json(res, 200, { totalResultsAvailable: 3, hits });
}

function handleEbayToken(req, res) {
  const auth = req.headers.authorization ?? '';
  requests.push({ source: 'ebay-oauth', authorization: auth.startsWith('Basic ') ? 'basic' : auth });
  if (!auth.startsWith('Basic ')) return json(res, 401, { error: 'invalid_client' });
  return json(res, 200, { access_token: 'e2e-ebay-app-token', expires_in: 7200, token_type: 'Application Access Token' });
}

function handleEbaySearch(url, req, res) {
  const q = url.searchParams.get('q') ?? '';
  requests.push({ source: 'ebay', keyword: q, authorization: req.headers.authorization ?? null, marketplace: req.headers['x-ebay-c-marketplace-id'] ?? null });
  if (req.headers.authorization !== 'Bearer e2e-ebay-app-token') return json(res, 401, { errors: [{ message: 'Invalid access token' }] });
  if (q.startsWith('__allfail')) return json(res, 500, { errors: [{ message: 'down' }] });
  if (q.startsWith('__ebayauth')) return json(res, 401, { errors: [{ message: 'Invalid access token' }] });
  if (q.startsWith('__empty')) return json(res, 200, { total: 0 });
  const itemSummaries = Array.from({ length: 3 }, (_, i) => ({
    itemId: `v1|e2e${i + 1}|0`,
    title: `[E2E eBay] ${q} item ${i + 1}`,
    price: { value: (60 + i * 20).toFixed(2), currency: 'USD' },
    image: { imageUrl: `https://i.ebayimg.com/images/g/e2e${i + 1}/s-l225.jpg` },
    itemWebUrl: `https://www.ebay.com/itm/e2e${i + 1}`,
    condition: 'Used',
    seller: { username: `e2e_seller${i + 1}` },
    shippingOptions: [{ shippingCost: { value: '0.00', currency: 'USD' } }],
  }));
  return json(res, 200, { total: 3, itemSummaries });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/__health') return json(res, 200, { ok: true });
  if (url.pathname === '/__requests') return json(res, 200, requests);
  if (url.pathname === '/__reset') {
    requests.length = 0;
    return json(res, 200, { ok: true });
  }
  if (url.pathname === YAHOO_PATH) return handleYahoo(url, res);
  if (url.pathname === EBAY_OAUTH_PATH) return handleEbayToken(req, res);
  if (url.pathname === EBAY_SEARCH_PATH) return handleEbaySearch(url, req, res);
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

  if (keyword.startsWith('__allfail')) return json(res, 500, { error: 'system_error', error_description: 'down' });
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
