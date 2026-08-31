import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductSearchBar } from './ProductSearchBar';
import { useResearchStore } from '../store/researchStore';
import * as marketSearchService from '../services/marketAdapters/marketSearchService';
import type { MarketSearchResponse } from '../types/market';

function deferredSearch() {
  let resolveSearch: (value: MarketSearchResponse) => void = () => {};
  const promise = new Promise<MarketSearchResponse>((resolve) => {
    resolveSearch = resolve;
  });
  return { promise, resolveSearch };
}

const emptyResponse: MarketSearchResponse = {
  cards: [],
  status: 'sample',
  warnings: [],
  searchedAt: '2026-07-22T00:00:00.000Z',
};

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

  it('検索入力はサーバー側契約と同じ100文字を上限にする', async () => {
    render(<ProductSearchBar onSearch={() => {}} />);
    const input = screen.getByLabelText('商品名・型番・JAN・URL') as HTMLInputElement;
    await userEvent.type(input, 'a'.repeat(101));
    expect(input.value).toHaveLength(100);
  });

  it('shows a 検索中… loading state and disables the button while a search is in flight', async () => {
    const deferred = deferredSearch();
    vi.spyOn(marketSearchService, 'runMarketSearch').mockReturnValue(deferred.promise);

    const onSearch = vi.fn();
    render(<ProductSearchBar onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText('商品名・型番・JAN・URL'), 'PS5');
    await userEvent.click(screen.getByRole('button', { name: 'まとめて探す' }));

    const loadingButton = await screen.findByRole('button', { name: '検索中…' });
    expect(loadingButton).toBeDisabled();
    expect(onSearch).not.toHaveBeenCalled();

    deferred.resolveSearch(emptyResponse);

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
            setTimeout(() => resolve(emptyResponse), 50),
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

  it('検索中にクエリを変更した場合、遅れて返った旧クエリ結果を現在状態へ適用しない', async () => {
    const deferred = deferredSearch();
    vi.spyOn(marketSearchService, 'runMarketSearch').mockReturnValue(deferred.promise);
    const onSearch = vi.fn();

    render(<ProductSearchBar onSearch={onSearch} />);
    const input = screen.getByLabelText('商品名・型番・JAN・URL');
    await userEvent.type(input, 'PS5');
    await userEvent.click(screen.getByRole('button', { name: 'まとめて探す' }));

    await userEvent.clear(input);
    await userEvent.type(input, 'Nintendo Switch');
    deferred.resolveSearch({
      ...emptyResponse,
      cards: [
        {
          id: 'old-result',
          title: 'PS5 old response',
          siteName: 'sample',
          sourceType: 'manual',
          pageUrl: 'https://example.com/ps5',
          confidence: 'high',
          createdAt: '2026-07-22T00:00:00.000Z',
        },
      ],
    });

    await waitFor(() => expect(useResearchStore.getState().isSearching).toBe(false));
    expect(useResearchStore.getState().query).toBe('Nintendo Switch');
    expect(useResearchStore.getState().resultCards).toHaveLength(0);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('検索中にデータソースを切り替えた場合、旧モードの結果を適用しない', async () => {
    const deferred = deferredSearch();
    vi.spyOn(marketSearchService, 'runMarketSearch').mockReturnValue(deferred.promise);
    const onSearch = vi.fn();

    render(<ProductSearchBar onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText('商品名・型番・JAN・URL'), 'PS5');
    await userEvent.click(screen.getByRole('button', { name: 'まとめて探す' }));
    await userEvent.selectOptions(screen.getByLabelText('データソースを選ぶ'), 'rakuten_mock');

    deferred.resolveSearch(emptyResponse);

    await waitFor(() => expect(useResearchStore.getState().isSearching).toBe(false));
    expect(useResearchStore.getState().dataSourceMode).toBe('rakuten_mock');
    expect(onSearch).not.toHaveBeenCalled();
  });
});
