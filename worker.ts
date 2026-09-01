import { onRequest } from './functions/api/rakuten';
import type { RakutenFunctionEnv } from './functions/api/rakuten';

/**
 * Cloudflare Workers 用エントリ。
 * Pages Functions（`functions/api/rakuten.ts`）と同じハンドラを `/api/rakuten` に載せる。
 * 静的 SPA は Vite + Cloudflare プラグインがビルドした assets が担当する。
 * `/api/*` だけ `run_worker_first` でこの Worker が先に動く。
 */
export default {
  async fetch(request: Request, env: RakutenFunctionEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/rakuten') {
      return onRequest({ request, env });
    }
    return new Response('Not found', { status: 404 });
  },
};
