import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductSearchBar } from './ProductSearchBar';
import { useResearchStore } from '../store/researchStore';
import * as marketSearchService from '../services/marketAdapters/marketSearchService';
import type { MarketSearchResponse } from '../types/market';

describe('ProductSearchBar', () => {
  beforeEach(() => {
    useResearchStore.setState({
      query: '',
      resultCards: [],
      isSearching: false,
      searchStatus: null,
      searchWarnings: [],
      dataSourceMode: 'sample',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables the search button until a query is entered', async () => {
    render(<ProductSearchBar onSearch={() => {}} />);
    const button = screen.getByRole('button', { name: 'まとめて探す' });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText('商品名・型番・JAN・URL');
    await userEvent.type(input, 'PS5');
    expect(button).toBeEnabled();
  });

  it('shows a 検索中… loading state and disables the button while a search is in flight', async () => {
    let resolveSearch: (value: MarketSearchResponse) => void = () => {};
    vi.spyOn(marketSearchService, 'runMarketSearch').mockReturnValue(
      new Promise<MarketSearchResponse>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    const onSearch = vi.fn();
    render(<ProductSearchBar onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText('商品名・型番・JAN・URL'), 'PS5');
    await userEvent.click(screen.getByRole('button', { name: 'まとめて探す' }));

    const loadingButton = await screen.findByRole('button', { name: '検索中…' });
    expect(loadingButton).toBeDisabled();
    expect(onSearch).not.toHaveBeenCalled();

    resolveSearch({ cards: [], status: 'sample', warnings: [], searchedAt: '2026-07-22T00:00:00.000Z' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'まとめて探す' })).toBeEnabled();
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('does not trigger a second search while one is already in flight (double-submit guard)', async () => {
    const searchSpy = vi
      .spyOn(marketSearchService, 'runMarketSearch')
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ cards: [], status: 'sample', warnings: [], searchedAt: '2026-07-22T00:00:00.000Z' }),
              50,
            ),
          ) as ReturnType<typeof marketSearchService.runMarketSearch>,
      );

    render(<ProductSearchBar onSearch={() => {}} />);
    await userEvent.type(screen.getByLabelText('商品名・型番・JAN・URL'), 'PS5');
    const button = screen.getByRole('button', { name: 'まとめて探す' });
    await userEvent.click(button);
    // The button is now disabled/relabeled, so a raw click bypassing UI state
    // (simulating a rapid double-click race) should still only fire once.
    await userEvent.click(screen.getByRole('button', { name: '検索中…' })).catch(() => {});

    await waitFor(() => expect(searchSpy).toHaveBeenCalledTimes(1));
  });
});
