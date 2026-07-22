import { defineConfig, devices } from '@playwright/test';

/**
 * E2E設定。ローカル/このリポジトリのCIでは `npm run preview`（ビルド済み静的サイト）に対して実行する。
 * 楽天APIプロキシ（Cloudflare Pages Functions）は起動しないため、`rakuten_mock` モードのテストは
 * 常にモックへフォールバックする経路のみを検証する（実APIの目視確認は人間の作業）。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    // ローカルで別バージョンの Chromium を使いたい場合のみ設定する（CIでは未設定のまま
    // `playwright install` が取得した既定のブラウザを使う）。
    ...(process.env.PLAYWRIGHT_LOCAL_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_LOCAL_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `--host` を明示しないと一部環境（GitHub Actionsのrunner等）で `vite preview` が
    // 127.0.0.1 からの接続を受け付けないことがあるため、全インターフェースにbindする。
    command: 'npm run preview -- --port 4173 --host 0.0.0.0',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
