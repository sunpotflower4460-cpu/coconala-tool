#!/usr/bin/env node
/**
 * 作ったデスクトップアプリ（インストーラーと同じビルド）を実際に起動して、最低限の動作を確かめる。
 *   node scripts/desktop-package-smoke.mjs <アプリの実行ファイル>
 * 画面が開く・window.desktop がある・キーの状態が読める・/api/* が JSON で答える（キー未設定なら no_key）。
 * 利用者の保存場所を汚さないよう、一時フォルダを保存場所にして起動する。
 */
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const executablePath = process.argv[2];
if (!executablePath || !fs.existsSync(executablePath)) {
  console.error(`アプリが見つかりません: ${executablePath}`);
  process.exit(1);
}
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'soba-package-smoke-'));
const app = await electron.launch({
  executablePath,
  env: { ...process.env, E2E_FAKE_UPSTREAM: '1', E2E_PLAIN_KEYSTORE: '1', E2E_USER_DATA: userData },
});
try {
  const page = await app.firstWindow();
  await page.waitForURL(/^app:\/\/bundle\//, { timeout: 30_000 });
  await page.getByRole('heading', { name: '相場カード比較ボード' }).waitFor({ timeout: 30_000 });
  const info = await page.evaluate(() => window.desktop?.appInfo());
  const status = await page.evaluate(() => window.desktop?.keys.status());
  const api = await page.evaluate(async () => {
    const res = await fetch('/api/rakuten?q=Switch');
    return { status: res.status, body: await res.json() };
  });
  if (!info?.version || !status || api.status !== 503 || api.body?.error !== 'no_key') {
    throw new Error(`想定外: ${JSON.stringify({ info, status, api })}`);
  }
  console.log(`OK ${info.version} ${info.platform}`);
} finally {
  await app.close().catch(() => undefined);
  fs.rmSync(userData, { recursive: true, force: true });
}
