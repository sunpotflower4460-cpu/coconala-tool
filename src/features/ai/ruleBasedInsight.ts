import { calcMargin, calcProfit, toJpyPrice } from '../profit/profitCalculator';
import type { MarketCard, ProfitSettings } from '../../types/market';

export type AiMemo = {
  id: string;
  text: string;
};

export function buildRuleBasedInsights(cards: MarketCard[], profitSettings: ProfitSettings): AiMemo[] {
  const memos: AiMemo[] = [];
  const profit = calcProfit(
    profitSettings.sellPrice,
    profitSettings.buyPrice,
    profitSettings.shippingCost,
    profitSettings.feeRate,
  );
  const margin = calcMargin(profit, profitSettings.sellPrice);

  if (profit <= 0 || margin < 10) {
    memos.push({
      id: 'thin-profit',
      text: '利益が薄い可能性があります。販売価格・仕入れ価格・送料を再確認してください。',
    });
  }

  if (profitSettings.shippingCost <= 0 || profitSettings.feeRate <= 0) {
    memos.push({
      id: 'shipping-fee-check',
      text: '送料・手数料が未反映の可能性があります。実際の条件を確認してください。',
    });
  }

  if (cards.some((card) => card.currency === 'USD')) {
    memos.push({
      id: 'usd-caution',
      text: 'USD換算価格が含まれます。為替レート変動の可能性がありますので確認してください。',
    });
  }

  const estimatedCards = cards.filter((card) => card.sourceType === 'search_api' || card.sourceType === 'search_link');
  if (cards.length > 0 && estimatedCards.length >= Math.ceil(cards.length / 2)) {
    memos.push({
      id: 'estimated-source',
      text: '検索表示から推定のカードが多いです。必ず元ページで価格・送料・状態を確認してください。',
    });
  }

  if (cards.some((card) => card.sourceType === 'manual')) {
    memos.push({
      id: 'manual-check',
      text: '手動追加カードはユーザー入力です。価格やURLに入力ミスの可能性がありますので確認してください。',
    });
  }

  const jpyPrices = cards
    .map((card) => toJpyPrice(card, profitSettings.exchangeRate))
    .filter((value): value is number => typeof value === 'number');

  if (jpyPrices.length >= 2) {
    const min = Math.min(...jpyPrices);
    const max = Math.max(...jpyPrices);
    if (min > 0 && max / min >= 1.5) {
      memos.push({
        id: 'price-gap',
        text: '価格差が大きい可能性があります。型番・付属品・状態違いを確認してください。',
      });
    }
  }

  if (memos.length === 0) {
    memos.push({
      id: 'stable',
      text: '大きな注意点は少なそうです。最終判断前に元ページ情報を確認してください。',
    });
  }

  return memos;
}
