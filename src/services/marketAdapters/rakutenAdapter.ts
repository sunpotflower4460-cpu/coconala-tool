import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';
import type { MarketSearchStatus } from '../../types/market';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import { searchRakutenMockItems } from '../../mocks/rakutenSearchMock';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';

const REQUEST_TIMEOUT_MS = 10_000;
const KEYWORD_HINT = 'モックデータでは「PS5」「SONY」「Nintendo」の語句で候補が見つかります。';

type MockStatus = Exclude<MarketSearchStatus, 'sample' | 'official_api' | 'empty'>;

const WARNING_BY_STATUS: Record<MockStatus, string> = {
  mock_no_key:
    '楽天APIキーが未設定のため、公式API想定モックを表示しています。実データを見るにはサーバー側に SERVER_RAKUTEN_APP_ID を設定してください。',
  mock_timeout: '楽天APIへの接続がタイムアウトしたため、公式API想定モックを表示しています。',
  mock_network:
    '楽天APIへの通信に失敗したため、公式API想定モックを表示しています。ネットワーク環境をご確認ください。',
  mock_rate_limited:
    '楽天APIのレート制限を超過したため、公式API想定モックを表示しています。しばらく時間をおいて再試行してください。',
  mock_upstream_error:
    '楽天APIから予期しない応答があったため、公式API想定モックを表示しています。',
};

const REAL_WARNING = '楽天市場 公式API取得。価格・在庫は変動します。最終確認は元ページで行ってください。';
const EMPTY_WARNING =
  '楽天市場 公式APIで該当商品が見つかりませんでした。「PS5」「SONY」「Nintendo」などの語句や検索語を変えてお試しください。';

type RakutenApiResponse = {
  items?: RakutenMockItem[];
  error?: string;
  status?: number;
};

/** 実APIに到達できないときのフォールバック。UXを壊さないよう必ずカードを返す。 */
function toMockResponse(query: string, limit: number, status: MockStatus): MarketSearchResponse {
  const response = searchRakutenMockItems(query, limit);
  const cards = response.Items.map(({ Item }) => ({
    ...mapRakutenItemToMarketCard(Item),
    note: '楽天市場 公式API想定モック',
    demoOrigin: 'mock' as const,
  }));
  const warnings = [WARNING_BY_STATUS[status]];
  if (!cards.length) warnings.push(KEYWORD_HINT);

  return { cards, status, warnings, searchedAt: new Date().toISOString() };
}

/**
 * 楽天市場 商品検索API アダプター。
 * サーバー側プロキシ `/api/rakuten` を叩き、`rakutenMapper` でカード化する。
 * キー未設定・ネットワーク失敗・タイムアウト・レート超過・上流エラー時は、
 * 理由を `status` / `warnings` に残したままモックへフォールバックする。
 */
export const rakutenAdapter: MarketAdapter = {
  id: 'rakuten',
  label: '楽天市場 商品検索API',
  sourceType: 'official_api',
  async search({ query, limit = 8 }: MarketSearchRequest): Promise<MarketSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { cards: [], status: 'empty', warnings: [], searchedAt: new Date().toISOString() };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`/api/rakuten?q=${encodeURIComponent(trimmed)}&limit=${limit}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return toMockResponse(trimmed, limit, 'mock_upstream_error');
      }

      const data = (await res.json()) as RakutenApiResponse;

      if (data.error === 'no_key') {
        return toMockResponse(trimmed, limit, 'mock_no_key');
      }
      if (data.error === 'upstream_error') {
        return toMockResponse(trimmed, limit, data.status === 429 ? 'mock_rate_limited' : 'mock_upstream_error');
      }
      if (data.error || !res.ok) {
        return toMockResponse(trimmed, limit, 'mock_upstream_error');
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        return { cards: [], status: 'empty', warnings: [EMPTY_WARNING], searchedAt: new Date().toISOString() };
      }

      return {
        cards: items.map((item) => mapRakutenItemToMarketCard(item)),
        status: 'official_api',
        warnings: [REAL_WARNING],
        searchedAt: new Date().toISOString(),
      };
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      return toMockResponse(trimmed, limit, isAbort ? 'mock_timeout' : 'mock_network');
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
