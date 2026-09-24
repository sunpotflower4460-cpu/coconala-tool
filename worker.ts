import { onRequest, errorResponse } from './functions/api/rakuten';
import type { RakutenFunctionEnv } from './functions/api/rakuten';

/** Workers Rate Limiting バインディング（`wrangler.jsonc` の `ratelimits`）。未設定の環境でも動くよう任意。 */
type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

export type WorkerEnv = RakutenFunctionEnv & {
  RAKUTEN_RATE_LIMITER?: RateLimiter;
};

/** 利用者ごとのレート制限キー。Cloudflare 上では CF-Connecting-IP をクライアントが偽装できない。 */
function rateLimitKey(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown-client';
}

/**
 * Cloudflare Workers 用エントリ。
 * 静的 SPA は Vite + Cloudflare プラグインがビルドした assets が担当する。
 * `/api/*` だけ `run_worker_first` でこの Worker が先に動く。
 */
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    // リバプロや末尾スラッシュ正規化漏れで `/api/rakuten/` になっても同じハンドラへ渡す。
    if (pathname === '/api/rakuten' || pathname === '/api/rakuten/') {
      if (env.RAKUTEN_RATE_LIMITER) {
        try {
          const { success } = await env.RAKUTEN_RATE_LIMITER.limit({ key: rateLimitKey(request) });
          if (!success) return errorResponse('rate_limited', 429);
        } catch {
          // レート制限サービス自体の障害で検索を止めない（楽天側の 429 は別途扱う）。
        }
      }
      return onRequest({ request, env });
    }
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' },
    });
  },
};
