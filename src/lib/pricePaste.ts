/**
 * 利用者が検索ページからコピーした文字の中から、価格らしい数字を取り出す（サイトへの自動アクセスは一切しない）。
 *  - 「¥12,800」「￥12,800」「12,800円」「現在 12,800円」などを拾う
 *  - クーポン・ポイント・送料・割引など、商品価格ではない行は除く
 *  - 100円未満・1,000万円超は価格として扱わない
 */
export const MIN_PASTED_PRICE = 100;
export const MAX_PASTED_PRICE = 10_000_000;
export const MAX_PASTED_PRICES = 300;

// 商品価格ではない金額が書かれやすい語（その行の金額は拾わない）
const NON_PRICE_LINE = /(クーポン|ポイント|pt|OFF|オフ|値引|割引|送料|配送料|手数料|以上で|以上購入|還元|獲得|残高|チャージ|まとめ買い|最大)/i;

const PRICE_PATTERN = /(?:[¥￥]\s*([0-9][0-9,]*))|(?:([0-9][0-9,]*)\s*円)/g;

export function extractPastedPrices(text: string): number[] {
  // 「¥」と金額が別の行に分かれてコピーされる場合（メルカリ等）は1行につなげる
  const normalized = text.normalize('NFKC').replace(/[¥￥][ \t]*\r?\n[ \t]*(?=[0-9])/g, '¥');
  const prices: number[] = [];
  for (const line of normalized.split(/\r?\n/)) {
    if (NON_PRICE_LINE.test(line)) continue;
    for (const match of line.matchAll(PRICE_PATTERN)) {
      const raw = (match[1] ?? match[2] ?? '').replace(/,/g, '');
      if (!/^\d+$/.test(raw)) continue;
      const value = Number(raw);
      if (value >= MIN_PASTED_PRICE && value <= MAX_PASTED_PRICE) prices.push(value);
      if (prices.length >= MAX_PASTED_PRICES) return prices;
    }
  }
  return prices;
}
