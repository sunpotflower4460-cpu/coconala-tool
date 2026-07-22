import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';
import { useResearchStore } from '../store/researchStore';
import * as marketSearchService from '../services/marketAdapters/marketSearchService';
import type { MarketSearchResponse } from '../types/market';

async function runSearch(query: string, response: MarketSearchResponse) {
  vi.spyOn(marketSearchService, 'runMarketSearch').mockResolvedValue(response);
  await userEvent.type(screen.getByLabelText('商品名・型番・JAN・URL'), query);
  await userEvent.click(screen.getByRole('button', { name: 'まとめて探す' }));
  // wait for the async handler to settle and re-render
  await screen.findByText(query, { exact: false }).catch(() => {});
}

describe('AppShell', () => {
  beforeEach(() => {
    useResearchStore.setState({
      query: '',
      resultCards: [],
      comparedCards: [],
      searchStatus: null,
      searchWarnings: [],
      isSearching: false,
      lastSearchedAt: null,
      dataSourceMode: 'sample',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the amber デモ表示中 badge before any search has happened', () => {
    render(<AppShell />);
    expect(screen.getByText('デモ表示中 — サンプル/モックデータ')).toBeInTheDocument();
    expect(screen.queryByText(/公式データ取得中/)).not.toBeInTheDocument();
  });

  it('switches to the green 公式データ取得中 badge after a search resolves with status=official_api', async () => {
    render(<AppShell />);
    await runSearch('PS5', {
      cards: [
        {
          id: 'r1',
          title: 'PS5 本体',
          siteName: '楽天市場',
          sourceType: 'official_api',
          priceText: '¥79,800',
          priceValue: 79800,
          currency: 'JPY',
          pageUrl: 'https://item.rakuten.co.jp/shop/ps5/',
          confidence: 'high',
          createdAt: '2026-07-22T00:00:00.000Z',
        },
      ],
      status: 'official_api',
      warnings: ['楽天市場 公式API取得。価格・在庫は変動します。'],
      searchedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(await screen.findByText('公式データ取得中 — 楽天市場')).toBeInTheDocument();
    expect(screen.queryByText('デモ表示中 — サンプル/モックデータ')).not.toBeInTheDocument();
  });

  it('shows the fallback reason banner and keeps the demo badge when the search falls back to mock', async () => {
    render(<AppShell />);
    await runSearch('SONY', {
      cards: [],
      status: 'mock_no_key',
      warnings: ['楽天APIキーが未設定のため、公式API想定モックを表示しています。'],
      searchedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(screen.getByText('デモ表示中 — サンプル/モックデータ')).toBeInTheDocument();
    expect(
      await screen.findByText('楽天APIキーが未設定のため、公式API想定モックを表示しています。'),
    ).toBeInTheDocument();
  });

  it('shows a 0件 empty-state message when a search returns no cards', async () => {
    render(<AppShell />);
    await runSearch('zzzz-no-result', {
      cards: [],
      status: 'empty',
      warnings: ['楽天市場 公式APIで該当商品が見つかりませんでした。'],
      searchedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(await screen.findByText(/該当する候補が見つかりませんでした/)).toBeInTheDocument();
  });
});
