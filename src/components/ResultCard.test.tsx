import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultCard } from './ResultCard';
import { useResearchStore } from '../store/researchStore';
import type { MarketCard } from '../types/market';

function makeCard(overrides: Partial<MarketCard> = {}): MarketCard {
  return {
    id: 'card-1',
    title: 'PS5 本体',
    siteName: '楽天市場',
    sourceType: 'official_api',
    priceText: '¥79,800',
    priceValue: 79800,
    currency: 'JPY',
    pageUrl: 'https://item.rakuten.co.jp/shop/ps5/',
    confidence: 'high',
    createdAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('ResultCard', () => {
  beforeEach(() => {
    useResearchStore.setState({ comparedCards: [] });
  });

  it('shows no demo-origin badge for a real (non-demo) card', () => {
    render(<ResultCard card={makeCard()} />);
    expect(screen.queryByText('サンプルデータ')).not.toBeInTheDocument();
    expect(screen.queryByText('モック（楽天API想定）')).not.toBeInTheDocument();
    expect(screen.getByText('公式API取得')).toBeInTheDocument();
  });

  it('shows the サンプルデータ badge for demoOrigin=sample', () => {
    render(<ResultCard card={makeCard({ demoOrigin: 'sample' })} />);
    expect(screen.getByText('サンプルデータ')).toBeInTheDocument();
  });

  it('shows the モック（楽天API想定） badge for demoOrigin=mock', () => {
    render(<ResultCard card={makeCard({ demoOrigin: 'mock', note: '楽天市場 公式API想定モック' })} />);
    expect(screen.getByText('モック（楽天API想定）')).toBeInTheDocument();
  });

  it('shows 価格不明 when there is no priceText', () => {
    render(<ResultCard card={makeCard({ priceText: undefined })} />);
    expect(screen.getByText('価格不明')).toBeInTheDocument();
  });

  it('maps each sourceType to its Japanese label', () => {
    const { rerender } = render(<ResultCard card={makeCard({ sourceType: 'search_api' })} />);
    expect(screen.getByText('検索表示から推定')).toBeInTheDocument();
    rerender(<ResultCard card={makeCard({ sourceType: 'search_link' })} />);
    expect(screen.getByText('検索リンク')).toBeInTheDocument();
    rerender(<ResultCard card={makeCard({ sourceType: 'manual' })} />);
    expect(screen.getByText('手動追加')).toBeInTheDocument();
  });

  it('toggles between 比較に追加 and 比較中 when clicked', async () => {
    render(<ResultCard card={makeCard()} />);
    const button = screen.getByRole('button', { name: /比較に追加/ });
    await userEvent.click(button);
    expect(await screen.findByRole('button', { name: /比較中/ })).toBeInTheDocument();
    expect(useResearchStore.getState().comparedCards).toHaveLength(1);
  });
});
