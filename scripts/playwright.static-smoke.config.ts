import { defineConfig, devices } from '@playwright/test';

/** 納品ZIPの app-static/ を検証する設定（scripts/verify-delivery.mjs から STATIC_SMOKE_URL 付きで呼ばれる）。 */
export default defineConfig({
  testDir: './static-smoke',
  reporter: 'list',
  use: { baseURL: process.env.STATIC_SMOKE_URL, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone SE'] } },
  ],
});
