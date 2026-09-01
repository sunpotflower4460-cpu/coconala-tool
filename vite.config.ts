/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Vitest は jsdom 上のコンポーネント／ユニットテスト専用。
// Cloudflare プラグイン（workerd）を混ぜると Worker ランタイム起動で遅くなる／落ちるため外す。
const isVitest = Boolean(process.env.VITEST);

// `/api/rakuten` は `worker.ts`（既存 Pages Function と同じハンドラ）が処理する。
// 楽天キーは `.dev.vars` の `SERVER_RAKUTEN_APP_ID`。未設定時は 503 `no_key` を返し、
// フロントはモックへフォールバックする。
// `npm run preview` は E2E のため `vite preview` のまま（`wrangler dev` にしない）。
export default defineConfig({
  plugins: [react(), ...(isVitest ? [] : [cloudflare()])],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ は Playwright（別ランナー）専用のため vitest の対象から除外する。
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
