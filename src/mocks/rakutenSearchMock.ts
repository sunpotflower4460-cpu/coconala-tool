/** 楽天市場の商品1件の形（/api/rakuten が返す items の要素）。実在しない見本データは持たない。 */
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
