import type { MarketAdapter, MarketSearchRequest, MarketSearchResponse } from './types';
import type { MarketCard } from '../../types/market';
import { fetchOfficial, type MockStatus } from './officialFetch';
import { mapRakutenItemToMarketCard } from './rakutenMapper';
import type { RakutenMockItem } from '../../mocks/rakutenSearchMock';
import { checkRakutenSearchQuery } from '../../lib/searchQuery';
import { IS_STATIC_BUILD } from '../../lib/deployMode';

/** 自動取得できないときの共通の案内（偽の商品は出さない）。 */
export const MANUAL_FALLBACK_HINT =
  'メルカリ等と同じく、下の相場一覧から楽天市場の検索ページを開き、ページをコピーして貼り付けると価格を並べられます。';

export const WARNING_BY_STATUS: Record<MockStatus, string> = {
  mock_no_key:
    '楽天市場との連携がまだ設定されていないため、楽天市場の商品は表示できません。実データを見るには、サーバーに楽天のアプリIDとアクセスキーを設定してください（設定ガイド参照）。',
  mock_setup_error:
    '楽天市場の設定（アプリID・アクセスキー・許可サイト）が正しくないため、楽天市場の商品を表示できません。設定ガイドの「楽天のキー設定」を確認してください。',
  mock_timeout: '楽天市場からの応答が遅いため、表示できませんでした。少し待ってからもう一度お試しください。',
  mock_network: '楽天市場に接続できませんでした。ネットワーク環境をご確認ください。',
  mock_rate_limited: '短時間に検索が集中しました。1分ほど待ってからもう一度お試しください。',
  mock_upstream_error: '楽天市場から想定外の応答があったため、表示できませんでした。時間をおいてお試しください。',
};

export const STATIC_BUILD_WARNING =
  'この版（パソコン内・かんたん公開）は、楽天市場・Yahoo!ショッピング・eBay の自動取得をしません。実データを使うには Cloudflare Workers 版で公開してください（設定ガイド参照）。';

export const REAL_WARNING = '楽天市場の実データです。価格・在庫は変動します。最終確認は元ページで行ってください。';
const EMPTY_WARNING = '楽天市場で該当する商品が見つかりませんでした。商品名・型番を短くするなど、検索語を変えてお試しください。';
export const INVALID_QUERY_WARNING =
  '楽天市場ではこの検索語を使えません。英数字だけの語は2文字以上、ひらがな・カタカナだけの語も2文字以上にして、もう一度お試しください。';

function invalidQueryResponse(): MarketSearchResponse {
  return { cards: [], status: 'invalid_query', warnings: [INVALID_QUERY_WARNING], searchedAt: new Date().toISOString() };
}

function mapItemsToCards(items: RakutenMockItem[]): MarketCard[] {
  return items
    .map((item) => mapRakutenItemToMarketCard(item))
    .filter((card): card is MarketCard => Boolean(card));
}

/** 取得できなかったときの応答。偽の商品は作らず、理由と、貼り付けで並べる方法だけを返す。 */
function unavailableResponse(status: MockStatus, warning?: string): MarketSearchResponse {
  return {
    cards: [],
    status,
    warnings: [warning ?? WARNING_BY_STATUS[status], MANUAL_FALLBACK_HINT],
    searchedAt: new Date().toISOString(),
  };
}

/** 楽天の結果。まとめて検索でも使う。 */
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
 * 偽の商品を出さず、理由と「貼り付けで並べる方法」を `status` / `warnings` で返す。
 * 検索語が楽天の規則に合わない場合は、検索語の見直しを案内する。
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
    const outcome = await fetchRakutenOutcome(query, limit);
    switch (outcome.kind) {
      case 'ok':
        return { cards: outcome.cards, status: 'official_api', warnings: [REAL_WARNING], searchedAt: new Date().toISOString() };
      case 'empty':
        return { cards: [], status: 'empty', warnings: [EMPTY_WARNING], searchedAt: new Date().toISOString() };
      case 'invalid_query':
        return invalidQueryResponse();
      case 'fail':
        return unavailableResponse(outcome.status, IS_STATIC_BUILD ? STATIC_BUILD_WARNING : undefined);
    }
  },
};
