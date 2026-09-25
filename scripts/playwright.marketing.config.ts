import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * 出品用素材の下書きとマニュアルを作る（`npm run marketing:capture`）。
 * 事前に `npm run build:desktop` でビルドしたデスクトップアプリを、偽サーバー（説明用の架空の商品・ページ）につないで撮影する。
 * 出力: dist-delivery/marketing/（PNG と操作動画 webm）、dist-delivery/manual/マニュアル.pdf
 */
export default defineConfig({
  testDir: './marketing',
  reporter: 'list',
  workers: 1,
  use: { locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  projects: [{ name: 'capture', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/fake-rakuten/server.mjs', url: 'http://127.0.0.1:43174/__health', reuseExistingServer: false, timeout: 30_000, cwd: REPO_ROOT },
  ],
});
