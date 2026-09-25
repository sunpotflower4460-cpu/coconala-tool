import type { MarketSearchStatus } from '../../types/market';

export type MockStatus = Extract<MarketSearchStatus, `mock_${string}`>;

/** 公式APIプロキシ（/api/rakuten・/api/yahoo・/api/ebay）1件分の結果。見本データへの切り替えは呼び出し側が決める。 */
export type RawOutcome<T> =
  | { kind: 'ok'; items: T[] }
  | { kind: 'empty' }
  | { kind: 'invalid_query' }
  | { kind: 'fail'; status: MockStatus };

const REQUEST_TIMEOUT_MS = 10_000;

/** サーバー側のエラーコード → 画面に出す状態。未知のコードは「楽天側の一時的な不具合」扱い。 */
const ERROR_CODE_TO_STATUS: Partial<Record<string, MockStatus>> = {
  no_key: 'mock_no_key',
  upstream_auth: 'mock_setup_error',
  rate_limited: 'mock_rate_limited',
  timeout: 'mock_timeout',
};

/**
 * 公式APIプロキシを呼び、共通の封筒 `{ items, status, error }` を検査して結果を分類する。
 * 例外は投げない（通信失敗・タイムアウトも RawOutcome として返す）。
 */
export async function fetchOfficial<T>(path: string, query: string, limit: number): Promise<RawOutcome<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${path}?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // サーバー（Worker）が無い公開方法では /api/* が HTML の 404 になる = 連携が未設定。
      return { kind: 'fail', status: res.status === 404 ? 'mock_no_key' : 'mock_upstream_error' };
    }

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      // JSONとして宣言された壊れた応答は「通信失敗」ではなく応答不整合として扱う。
      return { kind: 'fail', status: 'mock_upstream_error' };
    }
    // null / 配列 / 文字列 / 数値は property access で例外になり得る。通信失敗ではない。
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { kind: 'fail', status: 'mock_upstream_error' };

    const data = parsed as { items?: unknown; error?: unknown };
    if (data.error === 'invalid_query') return { kind: 'invalid_query' };
    if (data.error || !res.ok) {
      return { kind: 'fail', status: ERROR_CODE_TO_STATUS[String(data.error ?? '')] ?? 'mock_upstream_error' };
    }
    // 200でも期待する `items` 配列が無い場合は「0件」ではなく契約/スキーマ不整合。
    if (!Array.isArray(data.items)) return { kind: 'fail', status: 'mock_upstream_error' };
    if (!data.items.length) return { kind: 'empty' };
    return { kind: 'ok', items: data.items as T[] };
  } catch (err) {
    const isAbort = (err as { name?: string } | undefined)?.name === 'AbortError';
    return { kind: 'fail', status: isAbort ? 'mock_timeout' : 'mock_network' };
  } finally {
    clearTimeout(timeoutId);
  }
}
