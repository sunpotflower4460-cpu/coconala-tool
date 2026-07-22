/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// `/api/*` を Cloudflare Pages Functions（`wrangler pages dev`）へ転送する dev proxy。
// 楽天キーを設定したうえで Functions を別ポート（既定 8788）で起動すると、
// `npm run dev` から実APIを試せる。例:
//   npx wrangler pages dev dist --port 8788
// プロキシ先が起動していなくても、フロントは自動でモックにフォールバックする。
const FUNCTIONS_ORIGIN = 'http://127.0.0.1:8788';

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      '/api': {
        target: FUNCTIONS_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ は Playwright（別ランナー）専用のため vitest の対象から除外する。
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});