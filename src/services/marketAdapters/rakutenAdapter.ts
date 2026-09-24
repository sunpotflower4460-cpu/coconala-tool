import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';
import type { MarketCard, MarketSearchStatus } from '../../types/market';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import { searchRakutenMockItems } from '../../mocks/rakutenSearchMock';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';
import { checkRakutenSearchQuery } from '../../lib/searchQuery';
import { IS_STATIC_BUILD } from '../../lib/deployMode';

const REQUEST_TIMEOUT_MS = 10_000;
const KEYWORD_HINT = '見本データには「PS5」「ウォークマン」「3DS」などの候補があります。';


type MockStatus = Extract<MarketSearchStatus, `mock_${string}`>;

const WARNING_BY_STATUS: Record<MockStatus, string> = {
  mock_no_key:
    '楽天市場との連携がまだ設定されていないため、見本データを表示しています。実データを見るには、サーバーに楽天のアプリIDとアクセスキーを設定してください（設定ガイド参照）。',
  mock_setup_error:
    '楽天市場の設定（アプリID・アクセスキー・許可サイト）が正しくないため、見本データを表示しています。設定ガイドの「楽天のキー設定」を確認してください。',
  mock_timeout: '楽天市場からの応答が遅いため、見本データを表示しています。少し待ってからもう一度お試しください。',
  mock_network: '楽天市場に接続できなかったため、見本データを表示しています。ネットワーク環境をご確認ください。',
  mock_rate_limited:
    '短時間に検索が集中したため、見本データを表示しています。1分ほど待ってからもう一度お試しください。',
  mock_upstream_error: '楽天市場から想定外の応答があったため、見本データを表示しています。時間をおいてお試しください。',
};

const STATIC_BUILD_WARNING =
  'この公開版は楽天市場との連携なしで動作しています。見本データを表示しています。実データを使うには Cloudflare Workers 版で公開してください（設定ガイド参照）。';

const REAL_WARNING = '楽天市場の実データです。価格・在庫は変動します。最終確認は元ページで行ってください。';
const EMPTY_WARNING = '楽天市場で該当する商品が見つかりませんでした。商品名・型番を短くするなど、検索語を変えてお試しください。';
export const INVALID_QUERY_WARNING =
  '楽天市場ではこの検索語を使えません。英数字だけの語は2文字以上、ひらがな・カタカナだけの語も2文字以上にして、もう一度お試しください。';

type RakutenApiResponse = {
  items?: RakutenMockItem[];
  error?: string;
};

/**
 * サーバー側プロキシ（`functions/api/rakuten.ts`）のエラーコードから、
 * フロントで表示するモック状態への対応表。未知のコードは汎用の上流エラー扱いにする。
 */
const ERROR_CODE_TO_MOCK_STATUS: Partial<Record<string, MockStatus>> = {
  no_key: 'mock_no_key',
  upstream_auth: 'mock_setup_error',
  rate_limited: 'mock_rate_limited',
  timeout: 'mock_timeout',
};

function invalidQueryResponse(): MarketSearchResponse {
  return { cards: [], status: 'invalid_query', warnings: [INVALID_QUERY_WARNING], searchedAt: new Date().toISOString() };
}

/** 実APIに到達できないときのフォールバック。UXを壊さないよう必ずカードを返す。 */
function mapItemsToCards(items: RakutenMockItem[]): MarketCard[] {
  return items
    .map((item) => mapRakutenItemToMarketCard(item))
    .filter((card): card is MarketCard => Boolean(card));
}

function toMockResponse(query: string, limit: number, status: MockStatus, warning?: string): MarketSearchResponse {
  const response = searchRakutenMockItems(query, limit);
  const cards = mapItemsToCards(response.Items.map(({ Item }) => Item)).map((card) => ({
    ...card,
    note: '楽天市場の見本データ（実在しない商品です）',
    demoOrigin: 'mock' as const,
  }));
  const warnings = [warning ?? WARNING_BY_STATUS[status]];
  if (!cards.length) warnings.push(KEYWORD_HINT);

  return { cards, status, warnings, searchedAt: new Date().toISOString() };
}

/**
 * 楽天市場 商品検索API アダプター。
 * サーバー側プロキシ `/api/rakuten` を叩き、`rakutenMapper` でカード化する。
 * キー未設定・設定誤り・ネットワーク失敗・タイムアウト・レート超過・上流エラー時は、
 * 理由を `status` / `warnings` に残したまま見本データ（モック）へフォールバックする。
 * 検索語が楽天の規則に合わない場合は見本データを出さず、検索語の見直しを案内する。
 */
export const rakutenAdapter: MarketAdapter = {
  id: 'rakuten',
  label: '楽天市場 商品検索API',
  sourceType: 'official_api',
  async search({ query, limit = 8 }: MarketSearchRequest): Promise<MarketSearchResponse> {
    const check = checkRakutenSearchQuery(query);
    if (!check.ok) {
      if (check.issue === 'empty') return { cards: [], status: 'empty', warnings: [], searchedAt: new Date().toISOString() };
      return invalidQueryResponse();
    }
    const trimmed = check.value;

    if (IS_STATIC_BUILD) {
      return toMockResponse(trimmed, limit, 'mock_no_key', STATIC_BUILD_WARNING);
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
        // サーバー（Worker）が無い公開方法では /api/rakuten が HTML の 404 になる = 楽天連携が未設定。
        return toMockResponse(trimmed, limit, res.status === 404 ? 'mock_no_key' : 'mock_upstream_error');
      }

      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        // JSONとして宣言された壊れた応答は「通信失敗」ではなく応答不整合として扱う。
        return toMockResponse(trimmed, limit, 'mock_upstream_error');
      }

      // null / 配列 / 文字列 / 数値は property access で例外になり得る。通信失敗ではない。
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return toMockResponse(trimmed, limit, 'mock_upstream_error');
      }

      const data = parsed as RakutenApiResponse;

      if (data.error === 'invalid_query') {
        return invalidQueryResponse();
      }

      if (data.error || !res.ok) {
        return toMockResponse(trimmed, limit, ERROR_CODE_TO_MOCK_STATUS[data.error ?? ''] ?? 'mock_upstream_error');
      }

      // 200でも期待する `items` 配列が無い場合は「0件」ではなく契約/スキーマ不整合。
      // API変更や誤配信を正常な空検索と誤認しない。
      if (!Array.isArray(data.items)) {
        return toMockResponse(trimmed, limit, 'mock_upstream_error');
      }

      if (!data.items.length) {
        return { cards: [], status: 'empty', warnings: [EMPTY_WARNING], searchedAt: new Date().toISOString() };
      }

      const cards = mapItemsToCards(data.items);
      if (!cards.length) {
        // 商品は返ってきたが、必須URL等が欠けて1件もカード化できない = 契約不整合。
        return toMockResponse(trimmed, limit, 'mock_upstream_error');
      }

      return {
        cards,
        status: 'official_api',
        warnings: [REAL_WARNING],
        searchedAt: new Date().toISOString(),
      };
    } catch (err) {
      const isAbort = (err as { name?: string } | undefined)?.name === 'AbortError';
      return toMockResponse(trimmed, limit, isAbort ? 'mock_timeout' : 'mock_network');
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
