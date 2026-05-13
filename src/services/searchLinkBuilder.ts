import type { SearchShortcut } from '../types/market';

export function buildSearchLinks(query: string): SearchShortcut[] {
  if (!query.trim()) return [];
  const q = encodeURIComponent(query.trim());

  return [
    {
      id: 'google',
      siteName: 'Google 検索',
      description: 'Google で商品名を検索',
      url: `https://www.google.com/search?q=${q}`,
    },
    {
      id: 'google-image',
      siteName: 'Google 画像検索',
      description: 'Google 画像で見た目を確認',
      url: `https://www.google.com/search?tbm=isch&q=${q}`,
    },
    {
      id: 'mercari',
      siteName: 'メルカリ',
      description: 'メルカリで相場を確認',
      url: `https://jp.mercari.com/search?keyword=${q}`,
    },
    {
      id: 'yahoo-auctions',
      siteName: 'ヤフオク',
      description: 'ヤフオクで入札相場を確認',
      url: `https://auctions.yahoo.co.jp/search/search?p=${q}`,
    },
    {
      id: 'rakuma',
      siteName: 'ラクマ',
      description: 'ラクマで売買相場を確認',
      url: `https://fril.jp/search?query=${q}`,
    },
    {
      id: 'yahoo-shopping',
      siteName: 'Yahooショッピング',
      description: 'Yahooショッピングで新品相場を確認',
      url: `https://shopping.yahoo.co.jp/search?p=${q}`,
    },
    {
      id: 'ebay',
      siteName: 'eBay',
      description: 'eBay で海外相場を確認',
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
    },
  ];
}
