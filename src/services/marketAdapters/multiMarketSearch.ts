import type { MarketCard, MarketSearchResponse, MarketSearchStatus, OfficialMarketId, SourceResult } from '../../types/market';
import { MARKET_LABELS } from '../../types/market';
import { IS_STATIC_BUILD } from '../../lib/deployMode';
import { checkSearchQuery } from '../../lib/searchQuery';
import { fetchRakutenOutcome, INVALID_QUERY_WARNING, STATIC_BUILD_WARNING, type RakutenOutcome } from './rakutenAdapter';
import { fetchOfficialMarketOutcome } from './officialMarketAdapter';
import type { MockStatus } from './officialFetch';

const MARKETS: OfficialMarketId[] = ['rakuten', 'yahoo_shopping', 'ebay'];

/** サイトごとの失敗理由（1行・平易な言葉）。 */
const FAILURE_REASON: Record<MockStatus, string> = {
  mock_no_key: '連携がまだ設定されていません（設定ガイド参照）',
  mock_setup_error: 'キーまたは許可サイトの設定を確認してください',
  mock_timeout: '応答が遅いため表示できませんでした',
  mock_network: '接続できませんでした',
  mock_rate_limited: '短時間に検索が集中しました。1分ほど待ってください',
  mock_upstream_error: '想定外の応答がありました。時間をおいてお試しください',
};

const MULTI_REAL_WARNING = '楽天市場・Yahoo!ショッピング・eBay の実データです。価格・在庫は変動します。最終確認は元ページで行ってください。';
const MULTI_EMPTY_WARNING = '該当する商品が見つかりませんでした。商品名・型番を短くするなど、検索語を変えてお試しください。';
const ALL_FAILED_WARNING = '楽天市場・Yahoo!ショッピング・eBay のどれにも接続できなかったため、商品を表示できませんでした。';
export const MANUAL_HINT =
  'メルカリ等と同じく、下の相場一覧から各サイトの検索ページを開き、ページをコピーして貼り付けると価格を並べられます。';
const STATIC_SOURCE_MESSAGE = 'この版では自動取得しません（「開く」→ 貼り付け・入力で並べられます）';

async function fetchOutcome(market: OfficialMarketId, query: string, limit: number): Promise<RakutenOutcome> {
  try {
    return market === 'rakuten' ? await fetchRakutenOutcome(query, limit) : await fetchOfficialMarketOutcome(market, query, limit);
  } catch {
    return { kind: 'fail', status: 'mock_network' };
  }
}

/** 各サイトの結果を交互に並べ、どのサイトの商品も上の方に見えるようにする。 */
function interleave(groups: MarketCard[][]): MarketCard[] {
  const result: MarketCard[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i += 1) for (const group of groups) if (group[i]) result.push(group[i]);
  return result;
}

/**
 * データソース「まとめて」: 楽天市場・Yahoo!ショッピング・eBay の公式APIを同時に検索して1つの一覧にする。
 *  - 1サイトが失敗しても、他のサイトの実データは表示する（失敗したサイトは理由だけを表示する）。
 *  - すべて失敗したときも偽の商品は出さず、理由と「貼り付けで並べる方法」を案内する。
 */
export async function searchAllMarkets(query: string, limit = 8): Promise<MarketSearchResponse> {
  const searchedAt = () => new Date().toISOString();
  const check = checkSearchQuery(query);
  if (!check.ok) return { cards: [], status: 'empty', warnings: [], searchedAt: searchedAt() };

  if (IS_STATIC_BUILD) {
    return {
      cards: [],
      status: 'mock_no_key',
      warnings: [STATIC_BUILD_WARNING, MANUAL_HINT],
      searchedAt: searchedAt(),
      sources: MARKETS.map((market) => ({ market, outcome: 'failed', count: 0, message: STATIC_SOURCE_MESSAGE, failure: 'mock_no_key' })),
    };
  }

  const outcomes = await Promise.all(MARKETS.map((market) => fetchOutcome(market, check.value, limit)));
  const sources: SourceResult[] = MARKETS.map((market, i) => {
    const outcome = outcomes[i];
    if (outcome.kind === 'ok') return { market, outcome: 'ok', count: outcome.cards.length };
    if (outcome.kind === 'empty') return { market, outcome: 'empty', count: 0, message: '該当なし' };
    if (outcome.kind === 'invalid_query') return { market, outcome: 'invalid_query', count: 0, message: 'この検索語は使えません' };
    return { market, outcome: 'failed', count: 0, message: FAILURE_REASON[outcome.status], failure: outcome.status };
  });

  const cards = interleave(outcomes.map((o) => (o.kind === 'ok' ? o.cards : [])));
  const failureLines = sources
    .filter((s) => s.outcome === 'failed' || s.outcome === 'invalid_query')
    .map((s) => `${MARKET_LABELS[s.market]}: ${s.message}`);

  if (cards.length > 0) {
    return { cards, status: 'official_api', warnings: [MULTI_REAL_WARNING, ...failureLines], searchedAt: searchedAt(), sources };
  }
  if (sources.some((s) => s.outcome === 'empty')) {
    return { cards: [], status: 'empty', warnings: [MULTI_EMPTY_WARNING, ...failureLines], searchedAt: searchedAt(), sources };
  }
  if (sources.every((s) => s.outcome === 'invalid_query')) {
    return { cards: [], status: 'invalid_query', warnings: [INVALID_QUERY_WARNING], searchedAt: searchedAt(), sources };
  }

  const firstFailure = outcomes.find((o): o is { kind: 'fail'; status: MockStatus } => o.kind === 'fail');
  const status: MarketSearchStatus = firstFailure?.status ?? 'mock_upstream_error';
  return { cards: [], status, warnings: [ALL_FAILED_WARNING, ...failureLines, MANUAL_HINT], searchedAt: searchedAt(), sources };
}
