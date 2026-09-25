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
  if (isManual(query)) return json(res, 200, { totalResultsAvailable: MANUAL_YAHOO.length, hits: MANUAL_YAHOO });
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
  // 付属品が混ざった検索結果を再現（1件だけ極端に安い）
  if (query.startsWith('__outlier')) hits[0].price = 900;
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
  if (isManual(q)) return json(res, 200, { total: MANUAL_EBAY.length, itemSummaries: MANUAL_EBAY });
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


/**
 * デスクトップ版 E2E 用の架空の検索ページ（/fake-sites/<サイト>?q=...）。実サイトの画面の複製ではなく、
 * 「商品ページへのリンク＋値段」という一般的な形だけを再現する。__login でログイン画面（商品なし）を返す。
 */
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function fakeSitePage(market, q) {
  const n = [1, 2, 3, 4];
  const head = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>E2E ${esc(market)} ${esc(q)}</title></head><body>`;
  const nav = '<nav><a href="https://example.com/help">ヘルプ</a> <p>300円OFFクーポン配布中</p></nav>';
  if (q.startsWith('__login')) return `${head}<h1>ログインしてください</h1><form><input name="id"></form></body></html>`;
  let body = '';
  if (market === 'mercari') {
    body = '<ul>' + n.map((i) => `<li><a href="https://jp.mercari.com/item/m9000000000${i}?ref=e2e"><div><img alt="【E2Eメルカリ】${esc(q)} 出品${i}" src="data:,"><span>¥</span><span>${(i * 1000 + 7000).toLocaleString('ja-JP')}</span></div></a></li>`).join('') + '</ul>';
    // 付属品（外れ値）
    body += '<ul><li><a href="https://jp.mercari.com/item/m90000000099"><div><img alt="【E2Eメルカリ】保護フィルム" src="data:,"><span>¥</span><span>300</span></div></a></li></ul>';
  } else if (market === 'yahoo_auctions') {
    body = n.map((i) => `<div class="product"><h3><a href="https://auctions.yahoo.co.jp/jp/auction/x${1000 + i}">【E2Eヤフオク】${esc(q)} 出品${i}</a></h3><div>現在 ${(i * 900 + 6000).toLocaleString('ja-JP')}円</div><div>即決 ${(i * 900 + 9000).toLocaleString('ja-JP')}円</div><div>送料無料</div></div>`).join('');
  } else if (market === 'rakuma') {
    body = n.map((i) => `<div><a href="https://item.fril.jp/${'e2e0'.repeat(7)}000${i}"><p>【E2Eラクマ】${esc(q)} 出品${i}</p><p>¥${(i * 1100 + 6500).toLocaleString('ja-JP')}</p></a></div>`).join('');
  } else if (market === 'amazon') {
    body = '<div><a href="https://www.amazon.co.jp/dp/B0E2E00000/?ref_=nav">タイムセール</a></div>';
    body += n.map((i) => `<div class="result"><h2><a href="https://www.amazon.co.jp/E2E-Item/dp/B0E2E0000${i}/ref=sr_1_${i}">【E2EAmazon】${esc(q)} 商品${i}</a></h2><span>￥${(i * 1500 + 8000).toLocaleString('ja-JP')}</span><span>参考価格: ￥99,999</span></div>`).join('');
  }
  return `${head}${nav}<main>${body}</main></body></html>`;
}

/**
 * マニュアル・出品用の画面写真を撮るための、実在しない商品データ（検索語が「ワイヤレスイヤホン」で始まるとき）。
 * 店舗名・商品は架空。画像は /__placehold で作る（外部へは通信しない）。
 */
const MANUAL_Q = 'ワイヤレスイヤホン';
const isManual = (q) => String(q).startsWith(MANUAL_Q);
const ph = (label, color) => `https://placehold.co/300x200/${color}/ffffff?text=${encodeURIComponent(label)}`;
const MANUAL_RAKUTEN = [
  ['ワイヤレスイヤホン ノイズキャンセリング Bluetooth5.3 ブラック', 'サンプル家電 楽天市場店', 12980, 'Earbuds A', '1e3a8a', 0],
  ['ワイヤレスイヤホン 完全ワイヤレス 外音取り込み ホワイト', 'デモオーディオ', 14800, 'Earbuds B', '1d4ed8', 1],
  ['ワイヤレスイヤホン 専用ケース カバー 保護', '見本アクセサリー', 1280, 'Case', '334155', 0],
].map(([itemName, shopName, itemPrice, label, color, postageFlag], i) => ({
  itemCode: `demo-shop:${i + 1}`, itemName, shopName, itemPrice, itemUrl: `https://item.rakuten.co.jp/demo-shop/${i + 1}/`, mediumImageUrls: [ph(label, color)], postageFlag,
}));
const MANUAL_YAHOO = [
  ['ワイヤレスイヤホン ノイズキャンセリング 新品 国内正規品', 'サンプルストアY', 11800, 'Earbuds Y1', '6d28d9', 'new', '送料無料'],
  ['ワイヤレスイヤホン 未使用品 箱あり', 'デモリユース', 9980, 'Earbuds Y2', '7c3aed', 'used', '送料別'],
].map(([name, seller, price, label, color, condition, shipping], i) => ({
  code: `demo-y_${i + 1}`, name, url: `https://store.shopping.yahoo.co.jp/demo-y/${i + 1}.html`, price, image: { medium: ph(label, color) }, seller: { name: seller }, shipping: { name: shipping }, condition, inStock: true,
}));
const MANUAL_EBAY = [
  ['Wireless Earbuds Noise Cancelling Bluetooth (Japan ver.)', '89.99', 'eBay 1', '0f766e', 'New'],
  ['Wireless Earbuds ANC Used Good Condition', '64.50', 'eBay 2', '115e59', 'Used'],
].map(([title, value, label, color, condition], i) => ({
  itemId: `v1|demo${i + 1}|0`, title, price: { value, currency: 'USD' }, image: { imageUrl: ph(label, color) }, itemWebUrl: `https://www.ebay.com/itm/00000000010${i + 1}`, condition, seller: { username: 'demo_seller' }, shippingOptions: [{ shippingCost: { value: '0.00', currency: 'USD' } }],
}));
/** マニュアル用の見本の検索ページ（どのサイトの画面の複製でもない、説明用の簡単な一覧）。 */
function manualSitePage(market, q) {
  const names = { mercari: 'メルカリ', yahoo_auctions: 'ヤフオク', rakuma: 'ラクマ', amazon: 'Amazon' };
  const link = {
    mercari: (i) => `https://jp.mercari.com/item/m8000000000${i}`,
    yahoo_auctions: (i) => `https://auctions.yahoo.co.jp/jp/auction/d100000${i}`,
    rakuma: (i) => `https://item.fril.jp/${'0a1b2c3d'.repeat(4)}${i}`,
    amazon: (i) => `https://www.amazon.co.jp/dp/B0DEMO000${i}`,
  }[market];
  const base = { mercari: 9500, yahoo_auctions: 8200, rakuma: 9000, amazon: 12800 }[market];
  const items = [0, 1, 2, 3, 4, 5].map((i) => ({
    title: [`${q} 美品`, `${q} 箱あり 動作確認済み`, `${q} 新品未開封`, `${q} ジャンク扱い`, `${q} ケース付き`, `${q} 片耳のみ`][i],
    price: [base, base + 1200, base + 3400, Math.round(base * 0.55), base + 600, Math.round(base * 0.3)][i],
  }));
  const tiles = items
    .map((it, i) => `<a class="tile" href="${link(i + 1)}"><div class="img" style="background:hsl(${210 + i * 20} 45% 55%)">${esc(names[market])}</div><p class="t">${esc(it.title)}</p><p class="p">${market === 'yahoo_auctions' ? `現在 ${it.price.toLocaleString('ja-JP')}円` : `¥${it.price.toLocaleString('ja-JP')}`}</p></a>`)
    .join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(names[market])}（説明用の見本ページ）${esc(q)}</title><style>
    body{margin:0;font-family:"Hiragino Sans","Noto Sans JP",sans-serif;background:#fff;color:#111}
    header{padding:14px 20px;border-bottom:1px solid #e5e7eb;font-weight:700}
    header small{color:#6b7280;font-weight:400;margin-left:8px}
    main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:16px 20px}
    .tile{color:inherit;text-decoration:none}.img{height:120px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
    .t{margin:6px 0 2px;font-size:13px}.p{margin:0;font-weight:700}
  </style></head><body><header>${esc(names[market])} の検索結果 <small>（説明用の見本ページ。実際は各サイトの本物のページが表示されます）</small></header><main>${tiles}</main></body></html>`;
}
function placeholdSvg(pathname, searchParams) {
  const [, , color = '334155'] = pathname.replace('/__placehold', '').split('/');
  const label = esc(searchParams.get('text') ?? '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#${/^[0-9a-f]{6}$/i.test(color) ? color : '334155'}"/><text x="150" y="108" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle">${label}</text></svg>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/__health') return json(res, 200, { ok: true });
  if (url.pathname === '/__requests') return json(res, 200, requests);
  if (url.pathname === '/__reset') {
    requests.length = 0;
    return json(res, 200, { ok: true });
  }
  const fakeSite = /^\/fake-sites\/(mercari|yahoo_auctions|rakuma|amazon)$/.exec(url.pathname);
  if (fakeSite) {
    const q = url.searchParams.get('q') ?? '';
    requests.push({ source: `site-${fakeSite[1]}`, keyword: q });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(isManual(q) ? manualSitePage(fakeSite[1], q) : fakeSitePage(fakeSite[1], q));
  }
  if (url.pathname.startsWith('/__placehold/')) {
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    return res.end(placeholdSvg(url.pathname, url.searchParams));
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

  // デスクトップ版のキー設定テスト用: 間違ったキー
  if (url.searchParams.get('accessKey') === 'e2e-wrong-key') {
    return json(res, 401, { error: 'invalid_access_key', error_description: 'accessKey is not valid' });
  }
  if (!url.searchParams.get('applicationId') || !url.searchParams.get('accessKey')) {
    return json(res, 400, { error: 'wrong_parameter', error_description: 'specify valid applicationId and accessKey' });
  }

  if (keyword.startsWith('__allfail')) return json(res, 500, { error: 'system_error', error_description: 'down' });
  if (isManual(keyword)) return json(res, 200, { Items: MANUAL_RAKUTEN, count: MANUAL_RAKUTEN.length, page: 1 });
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
