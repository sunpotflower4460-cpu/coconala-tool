import { describe, expect, it } from 'vitest';
import { findItemPrice, findItemTitle, parseCapturedEntries, MAX_CAPTURED_PER_SITE } from './pageCapture';

const now = new Date('2026-09-25T00:00:00Z');

describe('findItemPrice', () => {
  it('¥ と金額が別の行でも読む（メルカリ等）', () => {
    expect(findItemPrice('¥\n12,800')).toBe(12800);
  });
  it('ヤフオクは先に出る「現在」の価格を使う', () => {
    expect(findItemPrice('商品名\n現在 6,900円\n即決 9,900円\n送料無料')).toBe(6900);
  });
  it('クーポン・ポイント・送料・参考価格の行は使わない', () => {
    expect(findItemPrice('300円OFFクーポン\n参考価格: ￥99,999\n￥9,500')).toBe(9500);
  });
  it('値段と参考価格・クーポンが同じ行に並んでいても、商品価格だけを読む', () => {
    expect(findItemPrice('商品名 ￥5,980 参考価格: ￥7,000')).toBe(5980);
    expect(findItemPrice('参考価格: ￥7,000 ￥5,980')).toBe(5980);
    expect(findItemPrice('300円OFF ¥4,500')).toBe(4500);
    expect(findItemPrice('送料 ¥750 ¥12,000')).toBe(12000);
  });
  it('全角の数字・円記号も読む', () => {
    expect(findItemPrice('￥１２，０００')).toBe(12000);
  });
  it('100円未満や値段の無い枠は undefined（推測で作らない）', () => {
    expect(findItemPrice('いいね 12\n残り3日')).toBeUndefined();
    expect(findItemPrice('¥50')).toBeUndefined();
  });
});

describe('findItemTitle', () => {
  it('画像の代替テキストがあれば優先する', () => {
    expect(findItemTitle({ url: 'x', text: '¥\n9,000', label: 'Switch 2 本体 美品' })).toBe('Switch 2 本体 美品');
  });
  it('読み上げ用ラベルの「…の画像 3,200円」から値段と「の画像」を取り除く', () => {
    expect(findItemTitle({ url: 'x', text: '', label: 'Switch Joy-Con ネオンブルーの画像 3,200円' })).toBe('Switch Joy-Con ネオンブルー');
    expect(findItemTitle({ url: 'x', text: '', label: 'Nintendo Switch 2 ストラップのサムネイル' })).toBe('Nintendo Switch 2 ストラップ');
    expect(findItemPrice('\nSwitch Joy-Con ネオンブルーの画像 3,200円')).toBe(3200);
  });
  it('ラクマのリンク説明（カテゴリ・「商品詳細ページへのリンク」）を除く', () => {
    expect(
      findItemTitle({ url: 'x', text: '', label: 'ポケモン レジェンズ ZA Nintendo Switch2 ポケモン(ポケモン)のエンタメ/ホビーのゲームソフト/ゲーム機本体(家庭用ゲームソフト)の商品詳細ページへのリンク' }),
    ).toBe('ポケモン レジェンズ ZA Nintendo Switch2');
    expect(
      findItemTitle({ url: 'x', text: '', label: 'Nintendo Switch 純正 Joy-Conグリップ 2個セット ニンテンドースイッチ(Nintendo Switch)のエンタメ/ホビーのゲームソフト/ゲーム機本体(その他)の商品詳細ページへのリンク' }),
    ).toBe('Nintendo Switch 純正 Joy-Conグリップ 2個セット');
    expect(
      findItemTitle({ url: 'x', text: '', label: 'Pokemon LEGENDS Z-A Nintendo Switch 2 Edition -Switch2 エンタメ/ホビーのゲームソフト/ゲーム機本体(その他)の商品詳細ページへのリンク' }),
    ).toBe('Pokemon LEGENDS Z-A Nintendo Switch 2 Edition -Switch2');
  });
  it('「最安値を見る」などの決まり文句は商品名にしない', () => {
    expect(findItemTitle({ url: 'x', text: '最安値を見る\n【Switch2】牧場物語 新品\n現在 5,000円', label: '最安値を見る' })).toBe('【Switch2】牧場物語 新品');
  });
  it('無ければ値段を含まない一番長い行', () => {
    expect(findItemTitle({ url: 'x', text: 'PR\nNintendo Switch 2 本体 新品未開封\n¥49,980\n送料無料', label: '' })).toBe(
      'Nintendo Switch 2 本体 新品未開封',
    );
  });
});

describe('parseCapturedEntries', () => {
  it('商品ページURLの形でサイトを判定し、クエリを除いた正規のURLで重複を除く', () => {
    const cards = parseCapturedEntries(
      'mercari',
      [
        { url: 'https://jp.mercari.com/item/m12345678901?ad_id=1', text: '¥\n8,000', label: 'A' + '品'.repeat(4) },
        { url: 'https://jp.mercari.com/item/m12345678901?ad_id=2', text: '¥\n8,000', label: '重複' },
        { url: 'https://jp.mercari.com/search?keyword=x', text: '¥\n1,000', label: '検索リンク' },
        { url: 'https://evil.example/item/m1', text: '¥\n1,000', label: '別サイト' },
      ],
      'Switch',
      now,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      pageUrl: 'https://jp.mercari.com/item/m12345678901',
      priceValue: 8000,
      priceText: '¥8,000',
      sourceType: 'search_api',
      confidence: 'low',
      market: 'mercari',
      siteName: 'メルカリ',
    });
    expect(cards[0].imageUrl).toBeUndefined();
    expect(cards[0].id.startsWith('captured-mercari-')).toBe(true);
  });

  it('Amazon は /dp/ASIN の短いURLにそろえ、値段の無いリンク（ナビ等）は捨てる', () => {
    const cards = parseCapturedEntries(
      'amazon',
      [
        { url: 'https://www.amazon.co.jp/dp/B0NAV00000/?ref_=nav', text: 'タイムセール', label: '' },
        { url: 'https://www.amazon.co.jp/Some-Item/dp/B0ITEM0001/ref=sr_1_1', text: '商品のなまえ ながい\n￥5,980\n参考価格: ￥7,000', label: '' },
      ],
      'q',
      now,
    );
    expect(cards.map((c) => [c.pageUrl, c.priceValue])).toEqual([['https://www.amazon.co.jp/dp/B0ITEM0001', 5980]]);
  });

  it('商品IDの途中で切らない（ヤフオクの英字つきID）', () => {
    const cards = parseCapturedEntries(
      'yahoo_auctions',
      [
        { url: 'https://auctions.yahoo.co.jp/jp/auction/x1001', text: '現在 1,000円', label: 'タイトルひとつめ' },
        { url: 'https://auctions.yahoo.co.jp/jp/auction/x1002', text: '現在 2,000円', label: 'タイトルふたつめ' },
        { url: 'https://auctions.yahoo.co.jp/jp/auction/e2e1003', text: '現在 3,000円', label: '形の違うID' },
      ],
      'q',
      now,
    );
    expect(cards.map((c) => c.pageUrl)).toEqual(['https://auctions.yahoo.co.jp/jp/auction/x1001', 'https://auctions.yahoo.co.jp/jp/auction/x1002']);
  });
  it('ヤフオク・ラクマの商品URLの形を受け付ける', () => {
    expect(parseCapturedEntries('yahoo_auctions', [{ url: 'https://auctions.yahoo.co.jp/jp/auction/x123456', text: '現在 1,000円', label: 'タイトルです' }], 'q', now)).toHaveLength(1);
    expect(parseCapturedEntries('rakuma', [{ url: 'https://item.fril.jp/0123456789abcdef0123', text: '¥2,000', label: 'タイトルです' }], 'q', now)).toHaveLength(1);
  });

  it(`1サイト最大 ${MAX_CAPTURED_PER_SITE} 件、壊れた値は無視する`, () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ url: `https://jp.mercari.com/item/m${10000000000 + i}`, text: `¥${1000 + i}`, label: `商品${i}番目` }));
    const broken = [null, { url: 1, text: 'x', label: '' }] as unknown as Parameters<typeof parseCapturedEntries>[1];
    expect(parseCapturedEntries('mercari', [...broken, ...many], 'q', now)).toHaveLength(MAX_CAPTURED_PER_SITE);
  });
});
