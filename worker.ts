import { onRequest } from './functions/api/rakuten';
import type { RakutenFunctionEnv } from './functions/api/rakuten';

/**
 * Cloudflare Workers 用エントリ。
 * Pages Functions（`functions/api/rakuten.ts`）と同じハンドラを `/api/rakuten` に載せる。
 * 静的 SPA は wrangler の assets が担当し、Worker は API だけ先に動かす。
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
