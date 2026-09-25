/**
 * 「表示中の値段を取り込む」で読んだ文字から、商品ごとの値段・商品名・商品ページURLを取り出す。
 *
 * 取り込みは利用者のボタン操作のときだけ、利用者が今見ている検索ページ1枚から行う（巡回・ページ送り・画像の保存はしない）。
 * ページ側では「商品ページへのリンク」と「そのリンクを含む枠の文字」だけを読み（`electron/capture.ts`）、
 * ここで値段と商品名を判定する。判定できない商品は捨てる（推測で値段を作らない）。
 */
import type { SiteMarket, CapturedEntry } from './desktopBridge';
import type { MarketCard } from '../types/market';
import { MARKET_LABELS } from '../types/market';
import { MAX_PASTED_PRICE, MIN_PASTED_PRICE } from './pricePaste';

/** サイトごとの「商品ページURL」の形。一致した部分（クエリ等を除いた正規のURL）を商品の識別に使う。 */
export const ITEM_URL_PATTERNS: Record<SiteMarket, string> = {
  mercari: String.raw`^https://jp\.mercari\.com/(?:item/m\d+|shops/product/[A-Za-z0-9]+)(?=[/?#]|$)`,
  yahoo_auctions: String.raw`^https://(?:page\.)?auctions\.yahoo\.co\.jp/jp/auction/[a-z]?\d+(?=[/?#]|$)`,
  rakuma: String.raw`^https://item\.fril\.jp/[0-9a-f]{16,}(?=[/?#]|$)`,
  amazon: String.raw`^https://www\.amazon\.co\.jp/(?:[^?#]*/)?dp/[A-Z0-9]{10}(?=[/?#]|$)`,
};

/** 1サイトから取り込む最大件数 */
export const MAX_CAPTURED_PER_SITE = 30;

const PRICE = /(?:[¥￥]\s*([0-9][0-9,]*))|(?:([0-9][0-9,]*)\s*円)/;
const PRICE_GLOBAL = new RegExp(PRICE.source, 'g');
// 金額の直前・直後にこれらの語があれば、商品価格ではない（クーポン・ポイント・送料・参考価格など）
const NON_PRICE_BEFORE = /(クーポン|ポイント|値引|割引|送料|配送料|手数料|還元|獲得|参考価格|過去価格|通常価格|定価|最大)[^¥￥0-9]{0,6}$/;
const NON_PRICE_AFTER = /^[^¥￥0-9]{0,3}(OFF|オフ|引き|以上|分|還元|ポイント|pt|相当)/i;
// 商品名として使わない行
const NOT_TITLE = /^(?:PR|広告|スポンサー|送料無料|即決|入札|残り.*|\d+件|NEW|SOLD|売り切れ|いいね.*)$/i;

function canonicalItemUrl(market: SiteMarket, url: string): string | null {
  const match = new RegExp(ITEM_URL_PATTERNS[market]).exec(url);
  if (!match) return null;
  if (market === 'amazon') {
    const asin = /dp\/([A-Z0-9]{10})/.exec(match[0])?.[1];
    return asin ? `https://www.amazon.co.jp/dp/${asin}` : null;
  }
  return match[0];
}

/**
 * 枠の文字から最初の「商品価格らしい金額」を取り出す（ヤフオクの「現在」「即決」は先に出る方＝現在価格）。
 * 金額の前後の語でクーポン・ポイント・送料・参考価格などを除く（値段と同じ行に並んでいても判定できる）。
 */
export function findItemPrice(text: string): number | undefined {
  const normalized = text.normalize('NFKC').replace(/[¥￥][ \t]*\r?\n[ \t]*(?=[0-9])/g, '¥');
  for (const m of normalized.matchAll(PRICE_GLOBAL)) {
    const start = m.index ?? 0;
    const before = normalized.slice(Math.max(0, start - 12), start).split(/\r?\n/).pop() ?? '';
    const after = (normalized.slice(start + m[0].length, start + m[0].length + 8).split(/\r?\n/)[0]) ?? '';
    if (NON_PRICE_BEFORE.test(before) || NON_PRICE_AFTER.test(after)) continue;
    const raw = (m[1] ?? m[2] ?? '').replace(/,/g, '');
    if (!/^\d+$/.test(raw)) continue;
    const value = Number(raw);
    if (value >= MIN_PASTED_PRICE && value <= MAX_PASTED_PRICE) return value;
  }
  return undefined;
}

/** 商品名: 画像の代替テキスト等があればそれ、無ければ値段を含まない一番長い行。 */
export function findItemTitle(entry: CapturedEntry): string {
  const label = entry.label.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (label.length >= 4 && !PRICE.test(label)) return label.slice(0, 120);
  const lines = entry.text
    .normalize('NFKC')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 4 && !PRICE.test(l) && !NOT_TITLE.test(l));
  const best = lines.sort((a, b) => b.length - a.length)[0];
  return (best ?? '').slice(0, 120);
}

function shortHash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** 取り込んだ文字を、画像なしの価格カード（出所: 検索表示から推定）に変える。 */
export function parseCapturedEntries(market: SiteMarket, entries: CapturedEntry[], query: string, now = new Date()): MarketCard[] {
  const label = MARKET_LABELS[market];
  const createdAt = now.toISOString();
  const seen = new Set<string>();
  const cards: MarketCard[] = [];
  for (const entry of entries) {
    if (cards.length >= MAX_CAPTURED_PER_SITE) break;
    if (typeof entry?.url !== 'string' || typeof entry.text !== 'string' || typeof entry.label !== 'string') continue;
    const url = canonicalItemUrl(market, entry.url);
    if (!url || seen.has(url)) continue;
    const price = findItemPrice(entry.text);
    if (price === undefined) continue;
    seen.add(url);
    const title = findItemTitle(entry) || `${query}（${label}の商品）`;
    cards.push({
      id: `captured-${market}-${shortHash(url)}`,
      title,
      siteName: label,
      sourceType: 'search_api',
      priceText: `¥${price.toLocaleString('ja-JP')}`,
      priceValue: price,
      currency: 'JPY',
      pageUrl: url,
      confidence: 'low',
      note: `${label}の検索ページから取り込んだ値段（参考）。最新の値段・状態は商品ページで確認してください。`,
      createdAt,
      market,
    });
  }
  return cards;
}
