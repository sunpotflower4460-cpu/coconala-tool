import { describe, it, expect } from 'vitest';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';

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

  it('does not throw when itemPrice is undefined and clamps Infinity', () => {
    expect(() => mapRakutenItemToMarketCard(makeItem({ itemPrice: undefined as unknown as number }))).not.toThrow();
    const inf = mapRakutenItemToMarketCard(makeItem({ itemPrice: Number.POSITIVE_INFINITY }));
    expect(inf?.priceValue).toBe(0);
  });

  it('drops javascript: image URLs', () => {
    const card = mapRakutenItemToMarketCard(
      makeItem({ mediumImageUrls: [{ imageUrl: 'javascript:alert(1)' }] }),
    );
    expect(card?.imageUrl).toBeUndefined();
  });
});
