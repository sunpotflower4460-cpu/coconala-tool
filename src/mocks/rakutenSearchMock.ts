export type RakutenMockImage = {
  imageUrl: string;
};

export type RakutenMockItem = {
  itemCode: string;
  itemName: string;
  shopName: string;
  itemPrice: number;
  mediumImageUrls: RakutenMockImage[];
  itemUrl: string;
  postageFlag: 0 | 1;
};

export type RakutenSearchMockResponse = {
  Items: Array<{ Item: RakutenMockItem }>;
  count: number;
  page: number;
};

const rakutenItems: RakutenMockItem[] = [
  {
    itemCode: 'mock-shop:ps5-cfi-2000a01',
    itemName: 'PlayStation 5 本体 CFI-2000A01 slim 新品',
    shopName: 'ゲームショップα',
    itemPrice: 79800,
    mediumImageUrls: [{ imageUrl: 'https://placehold.co/300x200/dc2626/ffffff?text=Rakuten+PS5' }],
    itemUrl: 'https://item.rakuten.co.jp/mock-shop/ps5-cfi-2000a01/',
    postageFlag: 0,
  },
  {
    itemCode: 'mock-audio:nw-a55-black',
    itemName: 'SONY ウォークマン NW-A55 ブラック 16GB',
    shopName: 'オーディオ館楽天市場店',
    itemPrice: 20800,
    mediumImageUrls: [{ imageUrl: 'https://placehold.co/300x200/991b1b/ffffff?text=Rakuten+Walkman' }],
    itemUrl: 'https://item.rakuten.co.jp/mock-audio/nw-a55-black/',
    postageFlag: 1,
  },
  {
    itemCode: 'mock-nintendo:3ds-ll-white',
    itemName: 'Nintendo 3DS LL ホワイト 中古美品',
    shopName: 'レトロゲーム本舗',
    itemPrice: 16500,
    mediumImageUrls: [{ imageUrl: 'https://placehold.co/300x200/7f1d1d/ffffff?text=Rakuten+3DS' }],
    itemUrl: 'https://item.rakuten.co.jp/mock-nintendo/3ds-ll-white/',
    postageFlag: 0,
  },
];

export function searchRakutenMockItems(keyword: string, limit = 8): RakutenSearchMockResponse {
  const normalized = keyword.trim().toLowerCase();
  const matched = rakutenItems.filter((item) => item.itemName.toLowerCase().includes(normalized));
  const items = (matched.length > 0 ? matched : []).slice(0, limit);

  return {
    Items: items.map((item) => ({ Item: item })),
    count: items.length,
    page: 1,
  };
}
