import { defineConfig } from '@playwright/test';

/**
 * デスクトップ版（Electron）の E2E。
 *  - 事前に `npm run build:desktop` でビルドした dist-desktop/ を起動する（e2e-desktop/fixtures.ts）。
 *  - 楽天・Yahoo!・eBay と、メルカリ等の架空の検索ページは偽サーバー（127.0.0.1:43175）が返す。
 *    Web 版 E2E（43174）と同時に動いてもぶつからないよう、ポートを分けている。
 */
export const DESKTOP_FAKE_PORT = 43175;

export default defineConfig({
  testDir: './e2e-desktop',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'dist-delivery/e2e-desktop-results.json' }]]
    : [['list'], ['json', { outputFile: 'dist-delivery/e2e-desktop-results.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node e2e/fake-rakuten/server.mjs',
    env: { FAKE_RAKUTEN_PORT: String(DESKTOP_FAKE_PORT) },
    url: `http://127.0.0.1:${DESKTOP_FAKE_PORT}/__health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
