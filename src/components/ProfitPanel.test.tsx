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

    const buyInput = screen.getByRole('spinbutton', { name: /仕入れ価格/ });
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
});
