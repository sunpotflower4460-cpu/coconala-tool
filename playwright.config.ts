import { defineConfig, devices } from '@playwright/test';

/**
 * E2E（動的監査）設定。
 *
 * ローカル / CI（既定）:
 *  - `e2e/fake-rakuten/server.mjs`（偽の楽天API、127.0.0.1 のみ）を起動する。
 *  - `wrangler.jsonc` の `env.e2e` でビルドした成果物を `vite preview` で配信する。
 *    `vite preview` は Cloudflare プラグイン経由で本番と同じ Worker（workerd）を動かすため、
 *    ブラウザ → /api/rakuten（実 Worker）→ 偽楽天API の本番同等の経路を検証できる。
 *  - 本番用の `dist/` と分けるため出力先は `dist-e2e/`。本番デプロイには e2e の設定は入らない。
 *  - 他のアプリとぶつかりにくいポート（43173 / 43174）を使い、既存サーバーの再利用はしない。
 *
 * デプロイ後の確認（`E2E_BASE_URL=https://... npm run e2e:postdeploy`）:
 *  - サーバーは起動せず、指定URLに対して `@postdeploy` タグのテストだけを実行する。
 */
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 43173);
const FAKE_RAKUTEN_PORT = 43174; // wrangler.jsonc の env.e2e.vars.RAKUTEN_API_BASE_OVERRIDE と一致させる
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${APP_PORT}`;
// GitHub Actions のランナーでは 127.0.0.1 だけにbindすると接続できないことがあったため、CI のみ全インターフェースにbindする。
const PREVIEW_HOST = process.env.CI ? '0.0.0.0' : '127.0.0.1';

// 機能テストはデスクトップで1回、見た目・操作性（layout / a11y）は全端末で実行する。
const LAYOUT_SPECS = /(layout|a11y)\.spec\.ts$/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // プレビューサーバー（Worker）は1つなので、同時に動かすテストを4つまでにして読み込みの時間切れを防ぐ
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // リトライで通ったテストも「不安定」として失敗扱いにし、たまたま通った結果を見逃さない。
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['json', { outputFile: 'dist-delivery/e2e-results.json' }]]
    : [['list'], ['json', { outputFile: 'dist-delivery/e2e-results.json' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    // ローカルで別バージョンの Chromium を使いたい場合のみ設定する。
    ...(process.env.PLAYWRIGHT_LOCAL_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_LOCAL_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'tablet-chromium',
      testMatch: LAYOUT_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: LAYOUT_SPECS,
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'mobile-webkit',
      testMatch: LAYOUT_SPECS,
      use: { ...devices['iPhone SE'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: 'node e2e/fake-rakuten/server.mjs',
          url: `http://127.0.0.1:${FAKE_RAKUTEN_PORT}/__health`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
        {
          command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${APP_PORT} --strictPort --host ${PREVIEW_HOST}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ],
});
