import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * 出品用素材の下書きを作る（`npm run marketing:capture`）。
 * E2E と同じく偽の楽天API＋本番同等の Worker を起動し、実データ表示の画面も撮影する。
 * 出力: dist-delivery/marketing/（PNG と操作動画 webm）
 */
export default defineConfig({
  testDir: './marketing',
  reporter: 'list',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:43173', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  projects: [{ name: 'capture', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/fake-rakuten/server.mjs', url: 'http://127.0.0.1:43174/__health', reuseExistingServer: false, timeout: 30_000, cwd: REPO_ROOT },
    {
      command: 'npm run build:e2e && npx vite preview --outDir dist-e2e --port 43173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:43173',
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: REPO_ROOT,
    },
  ],
});
