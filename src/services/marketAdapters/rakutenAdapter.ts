import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import { searchRakutenMockItems } from '../../mocks/rakutenSearchMock';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';

const REAL_WARNING = '楽天市場 公式API取得。価格・在庫は変動します。最終確認は元ページで行ってください。';
const EMPTY_WARNING = '楽天市場 公式APIで該当商品が見つかりませんでした。検索語を変えてお試しください。';
const FALLBACK_WARNING =
  '楽天の実APIに接続できなかったため、公式API想定モックを表示しています（APIキー未設定・ネットワーク失敗・レート超過のいずれか）。';

type RakutenApiResponse = {
  items?: RakutenMockItem[];
  error?: string;
};

/** 実APIに到達できないときのフォールバック。UXを壊さないよう必ずカードを返す。 */
function toMockResponse(query: string, limit: number): MarketSearchResponse {
  const response = searchRakutenMockItems(query, limit);
  return {
    cards: response.Items.map(({ Item }) => ({
      ...mapRakutenItemToMarketCard(Item),
      note: '楽天市場 公式API想定モック',
      demoOrigin: 'mock' as const,
    })),
    warnings: [FALLBACK_WARNING],
  };
}

/**
 * 楽天市場 商品検索API アダプター。
 * サーバー側プロキシ `/api/rakuten` を叩き、`rakutenMapper` でカード化する。
 * キー未設定・ネットワーク失敗・レート超過時は空配列ではなくモックへフォールバックする。
 */
export const rakutenAdapter: MarketAdapter = {
  id: 'rakuten',
  label: '楽天市場 商品検索API',
  sourceType: 'official_api',
  async search({ query, limit = 8 }: MarketSearchRequest): Promise<MarketSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) return { cards: [], warnings: [] };

    try {
      const res = await fetch(
        `/api/rakuten?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
        { headers: { accept: 'application/json' } },
      );
      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok || !contentType.includes('application/json')) {
        return toMockResponse(trimmed, limit);
      }

      const data = (await res.json()) as RakutenApiResponse;
      if (data.error) {
        return toMockResponse(trimmed, limit);
      }

      const items = Array.isArray(data.items) ? data.items : [];
      return {
        cards: items.map((item) => mapRakutenItemToMarketCard(item)),
        warnings: [items.length ? REAL_WARNING : EMPTY_WARNING],
      };
    } catch {
      return toMockResponse(trimmed, limit);
    }
  },
};
