#!/usr/bin/env node
/**
 * 生成した納品ZIPを「購入者と同じ立場」で検証する（`npm run delivery:verify`）。
 *
 *  1. ZIP を一時フォルダへ展開する（手元のリポジトリとは切り離す）
 *  2. 必須ファイルがあり、禁止ファイル（.env / .dev.vars / 内部資料 / scripts/）が無い
 *  3. checksums.txt と中身が一致する
 *  4. 文書のリンク切れ・見出しアンカー切れが無い
 *  5. 秘密情報らしき値が無い
 *  6. source/ だけで npm ci → lint → test → build が通り、Worker 設定も有効（wrangler deploy --dry-run）
 *  7. app-static/ を静的サーバーで配信し、ブラウザで主要フロー（検索→比較→利益→CSV）が動く
 *
 * 結果は dist-delivery/delivery-verify.json に保存する（verify:all のレポートが読む）。
 * オプション: --skip-install（npm ci 以降を省略。高速確認用）
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkMarkdownLinks } from './lib/markdown.mjs';
import { loadLocalSecretValues, scanForSecrets } from './lib/secrets.mjs';
import { sha256File, walkFiles } from './lib/files.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'dist-delivery');
const SKIP_INSTALL = process.argv.includes('--skip-install');

const REQUIRED = [
  'README_FIRST.md',
  'QUICK_START.md',
  'USER_GUIDE.md',
  'DEPLOY_GUIDE.md',
  'SUPPORT_POLICY.md',
  'PRIVACY_AND_DATA.md',
  'TERMS.md',
  'CHANGELOG.md',
  'QUALITY_REPORT.md',
  'checksums.txt',
  'app-static/index.html',
  'app-static/_headers',
  'app-static/theme-init.js',
  'source/package.json',
  'source/package-lock.json',
  'source/wrangler.jsonc',
  'source/worker.ts',
  'source/worker.test.ts',
  'source/functions/api/rakuten.ts',
  'source/e2e/fake-rakuten/server.mjs',
  'source/public/_headers',
  'source/.nvmrc',
  'source/.env.example',
  'source/docs/setup-guide.md',
];

const FORBIDDEN = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)/,
  /(^|\/)\.dev\.vars/,
  /(^|\/)AGENTS\.md$/,
  /(^|\/)COPILOT_INSTRUCTIONS\.md$/,
  /^source\/scripts\//,
  /(^|\/)node_modules\//,
  /^source\/dist/,
  /(^|\/)\.git\//,
  /docs\/(MANUAL_STEPS_SALES|coconala-listing-copy|qa-checklist|release-v1-checklist|manual-test-script|PRODUCTION_FAILURE_RISK_MATRIX|DELIVERY_CONTENTS|product-brief|data-source-policy|ux-principles|phase-roadmap)\.md$/,
  /docs\/(archive|adr)\//,
];

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`[delivery:verify] ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function run(cmd, args, cwd, env = {}) {
  const res = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: res.status === 0, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

/** 非同期で実行する（同じプロセス内の静的サーバーが応答し続けられるよう、イベントループを止めない）。 */
function runAsync(cmd, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: process.platform === 'win32' });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

function tail(text, lines = 15) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

/** app-static を Cloudflare Pages 相当（SPA・_headers）の最小サーバーで配信する。 */
function serveStatic(root) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = url.pathname.startsWith('/api/') ? '' : path.join(root, 'index.html');
    }
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/html' }).end('<!doctype html><title>404</title>');
      return;
    }
    const body = await fs.readFile(file).catch(() => null);
    if (!body) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
  const folder = `相場カード比較ボード-v${pkg.version}`;
  const zipPath = path.join(OUTPUT_DIR, `${folder}.zip`);
  await fs.access(zipPath).catch(() => {
    throw new Error(`${path.relative(REPO_ROOT, zipPath)} がありません。先に npm run delivery:package を実行してください。`);
  });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coconala-tool-verify-'));
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', workDir]);
    const root = path.join(workDir, folder);
    record('ZIPを展開できる', true, path.basename(zipPath));

    const files = (await walkFiles(root)).map((f) => path.relative(root, f).split(path.sep).join('/'));
    const missing = REQUIRED.filter((f) => !files.includes(f));
    record('必須ファイルがそろっている', missing.length === 0, missing.join(', '));
    const forbidden = files.filter((f) => FORBIDDEN.some((re) => re.test(f)));
    record('含めてはいけないファイル（秘密情報・内部資料・開発用スクリプト）が無い', forbidden.length === 0, forbidden.slice(0, 10).join(', '));

    const checksumLines = (await fs.readFile(path.join(root, 'checksums.txt'), 'utf-8')).trim().split('\n');
    const mismatched = [];
    for (const line of checksumLines) {
      const [hash, rel] = line.split(/\s{2}/);
      const actual = await sha256File(path.join(root, rel)).catch(() => 'missing');
      if (actual !== hash) mismatched.push(rel);
    }
    const unlisted = files.filter((f) => f !== 'checksums.txt' && !checksumLines.some((l) => l.endsWith(`  ${f}`)));
    record('checksums.txt と中身が一致する', mismatched.length === 0 && unlisted.length === 0, [...mismatched, ...unlisted].slice(0, 5).join(', '));

    const linkProblems = await checkMarkdownLinks(root);
    record('文書のリンク・見出しアンカーが切れていない', linkProblems.length === 0, linkProblems.slice(0, 5).join(' / '));

    const secrets = await scanForSecrets(root, await loadLocalSecretValues(REPO_ROOT));
    record('秘密情報らしき値が含まれていない', secrets.length === 0, secrets.slice(0, 5).join(' / '));

    const sourcePkg = JSON.parse(await fs.readFile(path.join(root, 'source/package.json'), 'utf-8'));
    const brokenScripts = Object.entries(sourcePkg.scripts ?? {}).filter(([, cmd]) => /scripts\//.test(cmd));
    record('source/package.json に納品物に無いスクリプトへの参照が無い', brokenScripts.length === 0, brokenScripts.map(([n]) => n).join(', '));

    const version = sourcePkg.version === pkg.version;
    const report = await fs.readFile(path.join(root, 'QUALITY_REPORT.md'), 'utf-8');
    record('バージョン表記がそろっている（package.json / 品質レポート）', version && report.includes(`v${pkg.version}`));

    if (!SKIP_INSTALL) {
      const source = path.join(root, 'source');
      for (const [label, args] of [
        ['source/ で npm ci できる', ['ci', '--no-audit', '--no-fund']],
        ['source/ で型チェックが通る（npm run lint）', ['run', 'lint']],
        ['source/ で単体テストが通る（npm test）', ['test']],
        ['source/ で本番ビルドできる（npm run build）', ['run', 'build']],
      ]) {
        const r = run('npm', args, source);
        record(label, r.ok, r.ok ? '' : tail(r.output));
        if (!r.ok) break;
      }
      const dry = run('npx', ['wrangler', 'deploy', '--dry-run'], source, { WRANGLER_SEND_METRICS: 'false' });
      record('source/ の Worker 設定が有効（wrangler deploy --dry-run）', dry.ok && /RAKUTEN_RATE_LIMITER/.test(dry.output), dry.ok ? '' : tail(dry.output));

      const dist = path.join(source, 'dist', 'client');
      const distSecrets = await scanForSecrets(dist, await loadLocalSecretValues(REPO_ROOT));
      const distText = (await Promise.all((await walkFiles(dist)).map((f) => fs.readFile(f, 'utf-8').catch(() => '')))).join('\n');
      record('購入者がビルドした画面ファイルに楽天キーの変数名・値が無い', distSecrets.length === 0 && !/SERVER_RAKUTEN|accessKey=/.test(distText));
    }

    // app-static を配信してブラウザで主要フローを確認する
    const server = await serveStatic(path.join(root, 'app-static'));
    const { port } = server.address();
    try {
      const smoke = await runAsync('npx', ['playwright', 'test', '--config', 'scripts/playwright.static-smoke.config.ts'], REPO_ROOT, {
        STATIC_SMOKE_URL: `http://127.0.0.1:${port}`,
      });
      record('app-static（静的版）がブラウザで動く（検索→比較→利益→CSV・楽天は見本データ）', smoke.ok, smoke.ok ? '' : tail(smoke.output, 25));
    } finally {
      server.close();
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, 'delivery-verify.json'), JSON.stringify({ version: pkg.version, results }, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`[delivery:verify] ${failed.length} 件失敗しました。`);
    process.exitCode = 1;
  } else {
    console.log(`[delivery:verify] すべて合格（${results.length} 項目）`);
  }
}

main().catch((err) => {
  console.error(`[delivery:verify] 失敗しました: ${err.message}`);
  process.exitCode = 1;
});
