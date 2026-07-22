import { describe, it, expect, beforeEach } from 'vitest';
import { useResearchStore } from './researchStore';

const defaultProfitSettings = {
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 0,
  feeRate: 10,
  exchangeRate: 155,
};

describe('researchStore profit settings validation', () => {
  beforeEach(() => {
    useResearchStore.setState({
      profitSettings: { ...defaultProfitSettings },
      buyPriceSource: null,
      sellPriceSource: null,
    });
  });

  it('clamps negative buyPrice to 0', () => {
    useResearchStore.getState().setProfitSettings({ buyPrice: -1000 });
    expect(useResearchStore.getState().profitSettings.buyPrice).toBe(0);
  });

  it('clamps NaN sellPrice to 0', () => {
    useResearchStore.getState().setProfitSettings({ sellPrice: Number('not-a-number') });
    expect(useResearchStore.getState().profitSettings.sellPrice).toBe(0);
  });

  it('clamps feeRate above 100 to 100', () => {
    useResearchStore.getState().setProfitSettings({ feeRate: 250 });
    expect(useResearchStore.getState().profitSettings.feeRate).toBe(100);
  });

  it('clamps negative feeRate to 0', () => {
    useResearchStore.getState().setProfitSettings({ feeRate: -5 });
    expect(useResearchStore.getState().profitSettings.feeRate).toBe(0);
  });

  it('accepts a valid positive shippingCost unchanged', () => {
    useResearchStore.getState().setProfitSettings({ shippingCost: 500 });
    expect(useResearchStore.getState().profitSettings.shippingCost).toBe(500);
  });

  it('manually editing buyPrice clears the buyPriceSource attribution', () => {
    useResearchStore.getState().applyPriceFromCard('buyPrice', 1000, 'メルカリ ¥1,000');
    expect(useResearchStore.getState().buyPriceSource).toBe('メルカリ ¥1,000');
    useResearchStore.getState().setProfitSettings({ buyPrice: 2000 });
    expect(useResearchStore.getState().buyPriceSource).toBeNull();
  });

  it('applyPriceFromCard clamps a negative/invalid amount to 0', () => {
    useResearchStore.getState().applyPriceFromCard('sellPrice', -50, 'ヤフオク');
    expect(useResearchStore.getState().profitSettings.sellPrice).toBe(0);
    expect(useResearchStore.getState().sellPriceSource).toBe('ヤフオク');
  });

  it('resetSession clears price source attribution', () => {
    useResearchStore.getState().applyPriceFromCard('buyPrice', 1000, 'メルカリ');
    useResearchStore.getState().resetSession();
    expect(useResearchStore.getState().buyPriceSource).toBeNull();
  });
});
