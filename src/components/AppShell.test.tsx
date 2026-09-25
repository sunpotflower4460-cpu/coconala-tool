import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  await waitFor(() => expect(useResearchStore.getState().lastSearchedAt).toBe(response.searchedAt));
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
      searchedQuery: '',
      dataSourceMode: 'rakuten_mock',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('検索前は「検索すると接続します」を表示し、サンプル・見本の表示は出さない', () => {
    render(<AppShell />);
    expect(screen.getByText('楽天市場 — 検索すると接続します')).toBeInTheDocument();
    expect(screen.queryByText(/実データ表示中/)).not.toBeInTheDocument();
    expect(screen.queryByText(/デモ表示中|サンプル|見本データ/)).not.toBeInTheDocument();
  });

  it('まとめてモードの検索前バッジ', () => {
    useResearchStore.setState({ dataSourceMode: 'multi' });
    render(<AppShell />);
    expect(screen.getByText('楽天・Yahoo!・eBay — 検索すると接続します')).toBeInTheDocument();
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

    expect(await screen.findByText('実データ表示中 — 楽天市場')).toBeInTheDocument();
    expect(screen.queryByText(/自動取得できませんでした/)).not.toBeInTheDocument();
  });

  it('接続できないときは理由と貼り付けの案内を出し、偽の商品は出さない', async () => {
    render(<AppShell />);
    await runSearch('SONY', {
      cards: [],
      status: 'mock_no_key',
      warnings: ['楽天市場との連携がまだ設定されていません。'],
      searchedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(screen.getByText('自動取得できませんでした — 貼り付け・手入力で比較')).toBeInTheDocument();
    expect(await screen.findByText('楽天市場との連携がまだ設定されていません。')).toBeInTheDocument();
    expect(screen.getByText(/実在しない商品を代わりに表示することはありません/)).toBeInTheDocument();
    expect(screen.queryByText(/デモ表示中|見本データ/)).not.toBeInTheDocument();
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

  it('履歴再開後は公式データ取得中バッジを出さない', async () => {
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
    expect(await screen.findByText('実データ表示中 — 楽天市場')).toBeInTheDocument();

    useResearchStore.getState().loadResearchSession({
      query: 'PS5',
      resultCards: [
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
      comparedCards: [],
      profitSettings: {
        buyPrice: 0,
        sellPrice: 0,
        shippingCost: 0,
        feeRate: 10,
        exchangeRate: 155,
      },
    });

    expect(await screen.findByText('楽天市場 — 検索すると接続します')).toBeInTheDocument();
    expect(screen.queryByText(/実データ表示中/)).not.toBeInTheDocument();
  });

  it('検索前でも比較ボード・利益計算・履歴・CSV を表示する（再読込後に保存データが見える）', () => {
    render(<AppShell />);
    expect(screen.getByRole('heading', { name: 'リサーチ履歴' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^比較ボード \(/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '利益見込み計算' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CSVエクスポート' })).toBeInTheDocument();
  });

  it('0件の検索結果でも「手動で追加」から登録できる', async () => {
    render(<AppShell />);
    await runSearch('Walkman', {
      cards: [],
      status: 'empty',
      warnings: ['該当する商品が見つかりませんでした。'],
      searchedAt: '2026-07-22T00:00:00.000Z',
    });
    await userEvent.click(screen.getByRole('button', { name: '手動で追加' }));
    expect(screen.getByRole('dialog', { name: '手動で追加' })).toBeInTheDocument();
  });

  it('楽天モードで実データ0件は実データ表示のまま', async () => {
    render(<AppShell />);
    expect(screen.getByText('楽天市場 — 検索すると接続します')).toBeInTheDocument();
    await runSearch('zzzz', { cards: [], status: 'empty', warnings: ['0件'], searchedAt: '2026-07-22T00:00:00.000Z' });
    expect(await screen.findByText('実データ表示中 — 楽天市場')).toBeInTheDocument();
    expect(screen.queryByText(/自動取得できませんでした/)).not.toBeInTheDocument();
  });

  it('検索リンクは入力途中の語ではなく、実際に検索した語で作る', async () => {
    render(<AppShell />);
    await runSearch('PS5', { cards: [], status: 'empty', warnings: [], searchedAt: '2026-07-22T00:00:00.000Z' });
    await userEvent.type(screen.getByLabelText('商品名・型番・JAN・URL'), ' 入力途中');
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(links.some((href) => href.includes('PS5'))).toBe(true);
    expect(links.some((href) => decodeURIComponent(href).includes('入力途中'))).toBe(false);
  });

  it('楽天ウェブサービス規約のクレジット表記を改変せずに表示する', () => {
    render(<AppShell />);
    const footer = screen.getByRole('contentinfo');
    const credit = within(footer).getByRole('link', { name: 'Supported by Rakuten Developers' });
    expect(credit).toHaveAttribute('href', 'https://developers.rakuten.com/');
    expect(credit).toHaveAttribute('target', '_blank');
  });
});
