import { describe, it, expect } from 'vitest';
import { extractPastedPrices } from './pricePaste';

describe('extractPastedPrices（コピーした検索ページから価格を拾う）', () => {
  it('メルカリ風のコピー: ¥記号と金額が別行でも拾い、クーポン・送料の行は除く', () => {
    const text = [
      'Nintendo Switch 2 の検索結果',
      '300円OFFクーポン配布中',
      '¥',
      '52,800',
      'Nintendo Switch 2 本体 美品',
      '¥52,800',
      '¥49,999',
      'Switch2 ケース',
      '¥1,280',
      '送料込み(出品者負担)',
    ].join('\n');
    expect(extractPastedPrices(text)).toEqual([52800, 52800, 49999, 1280]);
  });

  it('ヤフオク風: 「現在 12,800円」「即決 15,000円」、全角数字・全角円記号も拾う', () => {
    expect(extractPastedPrices('現在 12,800円\n即決 15,000円\n入札 3\n残り 2日')).toEqual([12800, 15000]);
    expect(extractPastedPrices('￥１２，８００')).toEqual([12800]);
  });

  it('Amazon風: ポイント・送料・割引の行は拾わず、100円未満も除く', () => {
    const text = '￥59,980\n598ポイント(1%)\n配送料 ￥480\n￥50 割引\n¥99\n参考価格: ¥64,800';
    expect(extractPastedPrices(text)).toEqual([59980, 64800]);
  });

  it('価格の無い文字や空文字は 0 件', () => {
    expect(extractPastedPrices('')).toEqual([]);
    expect(extractPastedPrices('該当する商品が見つかりません')).toEqual([]);
  });
});
