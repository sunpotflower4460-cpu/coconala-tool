import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfitPanel } from './ProfitPanel';
import { useResearchStore } from '../store/researchStore';

const defaultProfitSettings = {
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 0,
  feeRate: 10,
  exchangeRate: 155,
};

describe('ProfitPanel', () => {
  beforeEach(() => {
    useResearchStore.setState({
      profitSettings: { ...defaultProfitSettings },
      buyPriceSource: null,
      sellPriceSource: null,
      comparedCards: [],
    });
  });

  it('clamps a negative buyPrice entry to 0', async () => {
    render(<ProfitPanel />);
    const buyInput = screen.getByLabelText('仕入れ価格 (円)');
    await userEvent.clear(buyInput);
    await userEvent.type(buyInput, '-500');
    expect(useResearchStore.getState().profitSettings.buyPrice).toBe(0);
  });

  it('clamps a feeRate above 100 to 100', async () => {
    render(<ProfitPanel />);
    const feeInput = screen.getByLabelText('手数料率 (%)');
    await userEvent.clear(feeInput);
    await userEvent.type(feeInput, '250');
    expect(useResearchStore.getState().profitSettings.feeRate).toBe(100);
  });

  it('shows the tax/customs/fixed-fee disclosure note', () => {
    render(<ProfitPanel />);
    expect(screen.getByText(/消費税・関税等は含まれません/)).toBeInTheDocument();
    expect(screen.getByText(/固定手数料.*は含まれません/)).toBeInTheDocument();
  });

  it('does not show a price-source caption when no card price has been applied', () => {
    render(<ProfitPanel />);
    expect(screen.queryByText(/由来:/)).not.toBeInTheDocument();
  });

  it('shows a price-source caption after applyPriceFromCard, and clears it on manual edit', async () => {
    render(<ProfitPanel />);
    useResearchStore.getState().applyPriceFromCard('buyPrice', 1000, 'メルカリ ¥1,000');
    expect(await screen.findByText('由来: メルカリ ¥1,000')).toBeInTheDocument();

    const buyInput = screen.getByRole('textbox', { name: /仕入れ価格/ });
    await userEvent.clear(buyInput);
    await userEvent.type(buyInput, '2000');
    expect(screen.queryByText('由来: メルカリ ¥1,000')).not.toBeInTheDocument();
  });

  it('computes and displays the estimated profit', async () => {
    render(<ProfitPanel />);
    await userEvent.type(screen.getByLabelText('仕入れ価格 (円)'), '6000');
    await userEvent.type(screen.getByLabelText('販売価格 (円)'), '10000');
    await userEvent.clear(screen.getByLabelText('送料 (円)'));
    await userEvent.type(screen.getByLabelText('送料 (円)'), '500');
    // sell 10000 - fee(10%)=1000 - buy 6000 - shipping 500 = 2500
    expect(await screen.findByText(/\+2,500/)).toBeInTheDocument();
  });

  it('shows 0% fee as 0 instead of looking like the default 10', () => {
    useResearchStore.setState({
      profitSettings: { ...defaultProfitSettings, feeRate: 0 },
    });
    render(<ProfitPanel />);
    expect(screen.getByLabelText('手数料率 (%)')).toHaveValue('0');
  });

  it('全角数字・カンマ・「円」付きの入力も数値として受け付ける', async () => {
    render(<ProfitPanel />);
    const sell = screen.getByLabelText('販売価格 (円)');
    await userEvent.clear(sell);
    await userEvent.type(sell, '１２，８００円');
    expect(useResearchStore.getState().profitSettings.sellPrice).toBe(12800);
  });

  it('手数料率を消して打ち直しても「05」のような表示にならない', async () => {
    render(<ProfitPanel />);
    const fee = screen.getByLabelText('手数料率 (%)') as HTMLInputElement;
    await userEvent.clear(fee);
    expect(fee.value).toBe('');
    await userEvent.type(fee, '5');
    expect(fee.value).toBe('5');
    expect(useResearchStore.getState().profitSettings.feeRate).toBe(5);
  });

  it('数字でない入力はストアを壊さず、エラー表示して直前の値を保つ', async () => {
    useResearchStore.setState({ profitSettings: { ...defaultProfitSettings, buyPrice: 3000 } });
    render(<ProfitPanel />);
    const buy = screen.getByLabelText('仕入れ価格 (円)');
    await userEvent.clear(buy);
    await userEvent.type(buy, 'abc');
    expect(screen.getByText('数字で入力してください')).toBeInTheDocument();
    expect(buy).toHaveAttribute('aria-invalid', 'true');
    await userEvent.tab();
    expect(buy).toHaveValue('0');
  });

  it('手数料の端数は切り捨てて円単位で表示する', async () => {
    useResearchStore.setState({ profitSettings: { ...defaultProfitSettings, sellPrice: 1999 } });
    render(<ProfitPanel />);
    expect(screen.getByText(/1,999 - 199 - 0 - 0 = 1,800円/)).toBeInTheDocument();
  });
});
