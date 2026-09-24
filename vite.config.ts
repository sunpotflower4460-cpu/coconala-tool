/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// ビルドの種類は Vite の mode で切り替える（Windows でも同じコマンドで動くよう、環境変数の前置きは使わない）。
//  - 既定（production / development）: Cloudflare Workers 版。`/api/rakuten` は worker.ts が処理する。
//  - `--mode e2e`   : 自動テスト用。wrangler.jsonc の env.e2e（偽の楽天APIへ接続）でビルドする。
//  - `--mode static`: 楽天連携なしの静的版（納品物の app-static/）。
// Vitest は jsdom 上のテスト専用のため Cloudflare プラグイン（workerd）は読み込まない。
export default defineConfig(({ mode }) => {
  const isVitest = Boolean(process.env.VITEST);
  if (mode === 'e2e') process.env.CLOUDFLARE_ENV = 'e2e';

  return {
    plugins: [react(), ...(isVitest ? [] : [cloudflare()])],
    define: {
      'import.meta.env.VITE_DEPLOY_MODE': JSON.stringify(mode === 'static' ? 'static' : 'worker'),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      // e2e/ と scripts/ は Playwright（別ランナー）専用のため vitest の対象から除外する。
      exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'scripts/**'],
    },
  };
});
