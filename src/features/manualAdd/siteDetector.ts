const sitePatterns: { pattern: RegExp; name: string }[] = [
  { pattern: /ebay\.com/i, name: 'eBay' },
  { pattern: /mercari\.(com|jp)/i, name: 'メルカリ' },
  { pattern: /yahoo\.co\.jp\/auction/i, name: 'ヤフオク' },
  { pattern: /auctions\.yahoo\.co\.jp/i, name: 'ヤフオク' },
  { pattern: /shopping\.yahoo\.co\.jp/i, name: 'Yahooショッピング' },
  { pattern: /rakuten\.co\.jp/i, name: '楽天市場' },
  { pattern: /amazon\.co\.jp/i, name: 'Amazon JP' },
  { pattern: /amazon\.com/i, name: 'Amazon US' },
  { pattern: /fril\.jp/i, name: 'ラクマ' },
  { pattern: /paypay\-mall\.yahoo\.co\.jp/i, name: 'PayPayモール' },
];

export function detectSiteNameFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const full = hostname + pathname;
    for (const { pattern, name } of sitePatterns) {
      if (pattern.test(full)) return name;
    }
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
