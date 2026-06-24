import { sampleMarketCards } from '../../data/sampleMarketCards';
import type { DataSourceMode } from '../../types/market';
import { rakutenAdapter } from './rakutenAdapter';
import type { MarketSearchResponse } from './types';

const SAMPLE_WARNING =
  'サンプルデータ（UI確認用の固定カード）を表示しています。リアルタイム取得ではありません。';

/**
 * 検索の単一エントリ。`dataSourceMode` に応じて使うデータ経路を切り替える。
 *  - sample      : UI確認用の固定サンプルカード（全件）。
 *  - rakuten_mock: 楽天アダプター（キー設定時は実API、未設定/失敗時はモックへフォールバック）。
 *
 * 将来 eBay / Yahoo を足す場合も、ここに分岐を追加すれば UI を変えずに載る。
 */
export async function runMarketSearch(
  query: string,
  mode: DataSourceMode,
  limit = 8,
): Promise<MarketSearchResponse> {
  if (mode === 'sample') {
    return {
      cards: sampleMarketCards.map((card) => ({ ...card, demoOrigin: 'sample' as const })),
      warnings: [SAMPLE_WARNING],
    };
  }

  return rakutenAdapter.search({ query, limit });
}
