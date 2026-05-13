const sitePatterns: { pattern: RegExp; name: string }[] = [
  { pattern: /(^|\.)ebay\./i, name: 'eBay' },
  { pattern: /(^|\.)mercari\.(com|jp)/i, name: 'メルカリ' },
  { pattern: /(^|\.)yahoo\.co\.jp\/auction/i, name: 'ヤフオク' },
  { pattern: /auctions\.yahoo\.co\.jp/i, name: 'ヤフオク' },
  { pattern: /shopping\.yahoo\.co\.jp/i, name: 'Yahoo!ショッピング' },
  { pattern: /store\.shopping\.yahoo\.co\.jp/i, name: 'Yahoo!ショッピング' },
  { pattern: /(^|\.)(rakuma\.(com|jp)|fril\.jp)/i, name: 'ラクマ' },
  { pattern: /(^|\.)amazon\./i, name: 'Amazon' },
  { pattern: /(^|\.)rakuten\.(co\.jp|com)/i, name: '楽天市場' },
  { pattern: /(^|\.)search\.rakuten\.co\.jp/i, name: '楽天市場' },
  { pattern: /paypay\-mall\.yahoo\.co\.jp/i, name: 'PayPayモール' },
];

export function detectSiteNameFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const normalizedHost = hostname.replace(/^www\./, '');
    const full = hostname + pathname;
    for (const { pattern, name } of sitePatterns) {
      if (pattern.test(normalizedHost) || pattern.test(full)) return name;
    }
    return normalizedHost;
  } catch {
    return '';
  }
}
