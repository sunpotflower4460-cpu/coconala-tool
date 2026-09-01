import { describe, it, expect } from 'vitest';
import { mapRakutenItemToMarketCard, parseRakutenItemPrice } from './rakutenMapper';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';
import { MAX_AMOUNT } from '../../features/profit/profitCalculator';

function makeItem(overrides: Partial<RakutenMockItem> = {}): RakutenMockItem {
  return {
    itemCode: 'shop:1',
    itemName: 'PS5 本体',
    shopName: 'shop',
    itemPrice: 79800,
    mediumImageUrls: [{ imageUrl: 'https://example.com/a.jpg' }],
    itemUrl: 'https://item.rakuten.co.jp/shop/1/',
    postageFlag: 0,
    ...overrides,
  };
}

describe('mapRakutenItemToMarketCard', () => {
  it('maps a valid item to a card', () => {
    const card = mapRakutenItemToMarketCard(makeItem());
    expect(card?.id).toBe('rakuten-shop:1');
    expect(card?.pageUrl).toBe('https://item.rakuten.co.jp/shop/1/');
    expect(card?.priceValue).toBe(79800);
  });

  it('returns null when itemCode or itemName is missing', () => {
    expect(mapRakutenItemToMarketCard(makeItem({ itemCode: '' }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemName: '  ' }))).toBeNull();
  });

  it('returns null when itemUrl is not https', () => {
    expect(mapRakutenItemToMarketCard(makeItem({ itemUrl: 'http://insecure.example.com/item' }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemUrl: 'javascript:alert(1)' }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemUrl: '' }))).toBeNull();
  });

  it('不正な itemPrice ではカードを作らず ¥0 に変換しない', () => {
    expect(mapRakutenItemToMarketCard(makeItem({ itemPrice: undefined as unknown as number }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemPrice: Number.POSITIVE_INFINITY }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemPrice: Number.NaN }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemPrice: 'abc' as unknown as number }))).toBeNull();
    expect(mapRakutenItemToMarketCard(makeItem({ itemPrice: null as unknown as number }))).toBeNull();
  });

  it('正当な 0 円商品は残し、priceValue は 0 のまま', () => {
    const card = mapRakutenItemToMarketCard(makeItem({ itemPrice: 0 }));
    expect(card).not.toBeNull();
    expect(card?.priceValue).toBe(0);
    expect(card?.priceText).toBe('¥0');
  });

  it('正常価格と不正価格が混在しても正常商品だけ残る', () => {
    const mixed: RakutenMockItem[] = [
      makeItem({ itemCode: 'shop:ok1', itemPrice: 79800 }),
      makeItem({ itemCode: 'shop:undef', itemPrice: undefined as unknown as number }),
      makeItem({ itemCode: 'shop:abc', itemPrice: 'abc' as unknown as number }),
      makeItem({ itemCode: 'shop:nan', itemPrice: Number.NaN }),
      makeItem({ itemCode: 'shop:ok2', itemPrice: 1200 }),
    ];
    const cards = mixed.map(mapRakutenItemToMarketCard).filter((card): card is NonNullable<typeof card> => Boolean(card));
    expect(cards.map((card) => card.id)).toEqual(['rakuten-shop:ok1', 'rakuten-shop:ok2']);
    expect(cards.every((card) => card.priceValue !== 0 || card.id.endsWith('zero'))).toBe(true);
  });

  it('parseRakutenItemPrice は不正値を 0 へ変換しない', () => {
    expect(parseRakutenItemPrice(undefined)).toBeUndefined();
    expect(parseRakutenItemPrice(null)).toBeUndefined();
    expect(parseRakutenItemPrice('abc')).toBeUndefined();
    expect(parseRakutenItemPrice(Number.NaN)).toBeUndefined();
    expect(parseRakutenItemPrice(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(parseRakutenItemPrice(-1)).toBeUndefined();
    expect(parseRakutenItemPrice(MAX_AMOUNT + 1)).toBeUndefined();
    expect(parseRakutenItemPrice(0)).toBe(0);
    expect(parseRakutenItemPrice('1234')).toBe(1234);
  });

  it('drops javascript: image URLs', () => {
    const card = mapRakutenItemToMarketCard(
      makeItem({ mediumImageUrls: [{ imageUrl: 'javascript:alert(1)' }] }),
    );
    expect(card?.imageUrl).toBeUndefined();
  });
});
