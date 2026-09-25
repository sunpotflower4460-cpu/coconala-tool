import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';
import type { MarketCard } from '../../types/market';
import { fetchOfficial, type MockStatus } from './officialFetch';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import { searchRakutenMockItems } from '../../mocks/rakutenSearchMock';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';
import { checkRakutenSearchQuery } from '../../lib/searchQuery';
import { IS_STATIC_BUILD } from '../../lib/deployMode';

const KEYWORD_HINT = '見本データには「PS5」「ウォークマン」「3DS」などの候補があります。';


export const WARNING_BY_STATUS: Record<MockStatus, string> = {
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

export const STATIC_BUILD_WARNING =
  'この公開版は楽天市場との連携なしで動作しています。見本データを表示しています。実データを使うには Cloudflare Workers 版で公開してください（設定ガイド参照）。';

export const REAL_WARNING = '楽天市場の実データです。価格・在庫は変動します。最終確認は元ページで行ってください。';
const EMPTY_WARNING = '楽天市場で該当する商品が見つかりませんでした。商品名・型番を短くするなど、検索語を変えてお試しください。';
export const INVALID_QUERY_WARNING =
  '楽天市場ではこの検索語を使えません。英数字だけの語は2文字以上、ひらがな・カタカナだけの語も2文字以上にして、もう一度お試しください。';

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

/** 楽天の結果（見本データへの切り替え前）。まとめて検索でも使う。 */
export type RakutenOutcome =
  | { kind: 'ok'; cards: MarketCard[] }
  | { kind: 'empty' }
  | { kind: 'invalid_query' }
  | { kind: 'fail'; status: MockStatus };

export async function fetchRakutenOutcome(query: string, limit: number): Promise<RakutenOutcome> {
  const check = checkRakutenSearchQuery(query);
  if (!check.ok) return check.issue === 'empty' ? { kind: 'empty' } : { kind: 'invalid_query' };
  if (IS_STATIC_BUILD) return { kind: 'fail', status: 'mock_no_key' };

  const raw = await fetchOfficial<RakutenMockItem>('/api/rakuten', check.value, limit);
  if (raw.kind !== 'ok') return raw;
  const cards = mapItemsToCards(raw.items);
  // 商品は返ってきたが、必須URL等が欠けて1件もカード化できない = 契約不整合。
  if (!cards.length) return { kind: 'fail', status: 'mock_upstream_error' };
  return { kind: 'ok', cards };
}

/**
 * 楽天市場 商品検索API アダプター（データソース「楽天市場のみ」）。
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
    if (!check.ok && check.issue === 'empty') {
      return { cards: [], status: 'empty', warnings: [], searchedAt: new Date().toISOString() };
    }
    const trimmed = check.ok ? check.value : query.trim();
    const outcome = await fetchRakutenOutcome(query, limit);
    switch (outcome.kind) {
      case 'ok':
        return { cards: outcome.cards, status: 'official_api', warnings: [REAL_WARNING], searchedAt: new Date().toISOString() };
      case 'empty':
        return { cards: [], status: 'empty', warnings: [EMPTY_WARNING], searchedAt: new Date().toISOString() };
      case 'invalid_query':
        return invalidQueryResponse();
      case 'fail':
        return toMockResponse(trimmed, limit, outcome.status, IS_STATIC_BUILD ? STATIC_BUILD_WARNING : undefined);
    }
  },
};
