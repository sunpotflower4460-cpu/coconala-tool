#!/usr/bin/env node
/**
 * 納品ZIPを自動生成するスクリプト。
 *
 * 使い方: node scripts/create-delivery-package.mjs
 * 出力先: dist-delivery/相場カード比較ボード-v<version>.zip
 *
 * 方針:
 *  - コピー対象は「除外リスト」ではなく「許可リスト」で明示する（secure by default）。
 *    未知のファイル・意図しないファイルは、明示的に許可しない限り納品物に含めない。
 *  - 事前チェックに1つでも失敗したら ZIP を生成せず、非ゼロ終了コードで中断する。
 *    不完全な納品物を誤って作らないことを優先する。
 */

import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'dist-delivery');

const PRODUCT_NAME = '相場カード比較ボード';

/** `source/` へそのままコピーする、リポジトリ直下のファイル・ディレクトリ。 */
const SOURCE_ALLOWLIST = [
  'src',
  'functions',
  'e2e',
  'public',
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'playwright.config.ts',
  'vitest.setup.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'tailwind.config.js',
  'postcss.config.js',
  '.env.example',
  '.nvmrc',
  'README.md',
  'TERMS.md',
  'CHANGELOG.md',
];

/** `docs/` のうち、開発AI向け・出品者/社内向けの内部資料として除外するファイル名。 */
const DOCS_EXCLUDE = new Set([
  'product-brief.md',
  'data-source-policy.md',
  'ux-principles.md',
  'phase-roadmap.md',
  'coconala-listing-copy.md',
  'qa-checklist.md',
  'release-v1-checklist.md',
  'manual-test-script.md',
  'MANUAL_STEPS_SALES.md',
  'QUICK_START_BUYER.md', // ルートに QUICK_START.md として別名で同梱する
  'SUPPORT_POLICY.md', // ルートに SUPPORT_POLICY.md として別名で同梱する
]);
/** `docs/` 直下のサブディレクトリで、丸ごと除外するもの。 */
const DOCS_EXCLUDE_DIRS = new Set(['archive', 'adr']);

/** リポジトリ直下からは絶対にコピーしない（許可リストに無くても明示的に二重チェック）。 */
const NEVER_INCLUDE = new Set(['.env', '.dev.vars', 'AGENTS.md', 'COPILOT_INSTRUCTIONS.md']);

/** シークレットらしき環境変数の代入（1行単位で判定。行をまたいで誤検出しないようにする）。 */
const SECRET_ASSIGNMENT_LINE_PATTERN = /^\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|APP_ID|PASSWORD)[A-Z0-9_]*\s*=\s*(.+?)\s*$/;
/** ドキュメント中のプレースホルダーを誤検出しないための除外語（小文字化して部分一致判定）。 */
const PLACEHOLDER_HINTS = ['your', 'example', 'placeholder', 'xxxx', 'changeme', 'dummy', 'sample', 'todo', 'insert', 'here', '<', '>'];
const MIN_PLAUSIBLE_SECRET_LENGTH = 8;

function looksLikePlaceholder(value) {
  const unquoted = value.replace(/^['"]|['"]$/g, '');
  if (unquoted.length < MIN_PLAUSIBLE_SECRET_LENGTH) return true;
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(unquoted)) return true; // 非ASCII（日本語の案内文など）はプレースホルダー扱い
  const lower = unquoted.toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => lower.includes(hint));
}

function log(message) {
  console.log(`[delivery] ${message}`);
}

function fail(message) {
  console.error(`[delivery] ERROR: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson() {
  const raw = await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf-8');
  return JSON.parse(raw);
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      if (NEVER_INCLUDE.has(entry.name)) continue;
      await copyRecursive(path.join(src, entry.name), path.join(dest, entry.name));
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

async function stageSource(stagingDir) {
  const sourceDir = path.join(stagingDir, 'source');
  await fs.mkdir(sourceDir, { recursive: true });

  for (const name of SOURCE_ALLOWLIST) {
    if (NEVER_INCLUDE.has(name)) continue; // 二重チェック
    const srcPath = path.join(REPO_ROOT, name);
    if (!(await pathExists(srcPath))) continue; // 任意ファイル（public/ 等）は無くてもよい
    await copyRecursive(srcPath, path.join(sourceDir, name));
  }

  // docs/ はホワイトリストではなく除外リスト方式（買い手向け文書は増減しやすいため）。
  const docsSrc = path.join(REPO_ROOT, 'docs');
  const docsDest = path.join(sourceDir, 'docs');
  if (await pathExists(docsSrc)) {
    await fs.mkdir(docsDest, { recursive: true });
    const entries = await fs.readdir(docsSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (DOCS_EXCLUDE_DIRS.has(entry.name)) continue;
        await copyRecursive(path.join(docsSrc, entry.name), path.join(docsDest, entry.name));
      } else {
        if (DOCS_EXCLUDE.has(entry.name)) continue;
        await fs.copyFile(path.join(docsSrc, entry.name), path.join(docsDest, entry.name));
      }
    }
  }

  return sourceDir;
}

async function stageRootDocs(stagingDir, version) {
  const copies = [
    ['README.md', 'README_FIRST.md'],
    ['docs/QUICK_START_BUYER.md', 'QUICK_START.md'],
    ['docs/user-guide.md', 'USER_GUIDE.md'],
    ['TERMS.md', 'TERMS.md'],
    ['docs/SUPPORT_POLICY.md', 'SUPPORT_POLICY.md'],
    ['CHANGELOG.md', 'CHANGELOG.md'],
  ];
  for (const [from, to] of copies) {
    const src = path.join(REPO_ROOT, from);
    if (!(await pathExists(src))) fail(`必須ファイルが見つかりません: ${from}`);
    await fs.copyFile(src, path.join(stagingDir, to));
  }

  const sampleDir = path.join(stagingDir, 'sample');
  await fs.mkdir(sampleDir, { recursive: true });
  await fs.writeFile(
    path.join(sampleDir, 'README.md'),
    `# sample\n\nここに商品画像・操作動画を配置してください（v${version} 時点では未生成です）。\n` +
      '詳細は docs/MANUAL_STEPS_SALES.md（開発リポジトリ側）を参照してください。\n',
    'utf-8',
  );
}

async function walkFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(full)));
    } else {
      results.push(full);
    }
  }
  return results;
}

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function writeChecksums(stagingDir) {
  const files = (await walkFiles(stagingDir)).sort();
  const lines = [];
  for (const file of files) {
    const rel = path.relative(stagingDir, file).split(path.sep).join('/');
    lines.push(`${await sha256(file)}  ${rel}`);
  }
  await fs.writeFile(path.join(stagingDir, 'checksums.txt'), `${lines.join('\n')}\n`, 'utf-8');
}

/** ステージング済みファイルに、値の入ったシークレットらしき代入が無いか走査する。 */
async function scanForSecrets(stagingDir) {
  const files = await walkFiles(stagingDir);
  const offenders = [];
  for (const file of files) {
    if (path.basename(file) === 'checksums.txt') continue;
    let content;
    try {
      content = await fs.readFile(file, 'utf-8');
    } catch {
      continue; // バイナリファイル等はスキップ
    }
    const lines = content.split('\n');
    for (const line of lines) {
      const m = line.match(SECRET_ASSIGNMENT_LINE_PATTERN);
      if (!m) continue;
      const value = m[1];
      if (!value || looksLikePlaceholder(value)) continue;
      offenders.push(`${path.relative(stagingDir, file)}: ${line.trim()}`);
    }
  }
  return offenders;
}

async function runPreChecks(version) {
  const errors = [];

  const readme = await fs.readFile(path.join(REPO_ROOT, 'README.md'), 'utf-8');
  if (!readme.includes(`v${version}`)) {
    errors.push(`README.md にバージョン v${version} の記載が見つかりません。`);
  }

  if (!(await pathExists(path.join(REPO_ROOT, 'package-lock.json')))) {
    errors.push('package-lock.json が見つかりません。');
  }

  if (!(await pathExists(path.join(REPO_ROOT, '.env.example')))) {
    errors.push('.env.example が見つかりません。');
  }

  for (const forbidden of ['.env', '.dev.vars']) {
    if (SOURCE_ALLOWLIST.includes(forbidden)) {
      errors.push(`${forbidden} が許可リストに含まれています（設定ミス）。`);
    }
  }

  if (errors.length) {
    for (const e of errors) console.error(`[delivery] PRE-CHECK FAILED: ${e}`);
    fail(`事前チェックに ${errors.length} 件失敗しました。`);
  }
  log('事前チェック: OK');
}

async function zipDirectory(stagingDir, zipPath, rootFolderName) {
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(stagingDir, rootFolderName);
    archive.finalize();
  });
}

async function main() {
  const pkg = await readPackageJson();
  const version = pkg.version;
  log(`バージョン: ${version}`);

  await runPreChecks(version);

  const rootFolderName = `${PRODUCT_NAME}-v${version}`;
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coconala-tool-delivery-'));
  const stagingDir = path.join(stagingRoot, rootFolderName);
  await fs.mkdir(stagingDir, { recursive: true });

  try {
    log('ソースをステージング中...');
    await stageSource(stagingDir);

    log('購入者向けドキュメントをステージング中...');
    await stageRootDocs(stagingDir, version);

    log('シークレットパターンを走査中...');
    const offenders = await scanForSecrets(stagingDir);
    if (offenders.length) {
      for (const o of offenders) console.error(`[delivery] SECRET DETECTED: ${o}`);
      fail(`シークレットらしき値が ${offenders.length} 件見つかりました。納品物には含められません。`);
    }
    log('シークレット走査: OK（検出なし）');

    log('チェックサムを生成中...');
    await writeChecksums(stagingDir);

    const zipPath = path.join(OUTPUT_DIR, `${rootFolderName}.zip`);
    log(`ZIPを生成中: ${zipPath}`);
    await zipDirectory(stagingDir, zipPath, rootFolderName);

    log(`完了: ${path.relative(REPO_ROOT, zipPath)}`);
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  if (!process.exitCode) process.exitCode = 1;
  console.error(`[delivery] 失敗しました: ${err.message}`);
});
