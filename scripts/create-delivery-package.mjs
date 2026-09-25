#!/usr/bin/env node
/**
 * 納品物を生成する（`npm run delivery:package`）。
 * 出力: dist-delivery/納品ファイル-v<version>/ に次の5ファイル（ココナラのトークルームで送れるよう各200MB未満）
 *   ①アプリ（Windows用）.exe / ①アプリ（Mac・Appleシリコン用）.dmg / ①アプリ（Mac・Intel用）.dmg
 *   ②マニュアル.pdf / ③詳しい資料（公開・改造する人向け）.zip
 *
 * 方針:
 *  - コピー対象は許可リスト（secure by default）。さらに Git 管理下（未追跡でも .gitignore 対象外）のファイルだけを使い、
 *    `.env` / `.dev.vars` / ビルド成果物などの無視ファイルが紛れ込まないようにする。
 *  - 購入者向け文書はZIP直下に置き、文書内の相対リンクをZIPの構成に合わせて自動で書き換える。
 *    書き換え先が納品物に無いリンクが1つでもあれば中断する（リンク切れのまま納品しない）。
 *  - 楽天連携なしの静的版（`app-static/`）をビルドして同梱する。
 *  - シークレットらしき値・ローカルの実キーと同じ文字列が見つかったら中断する。
 *  - 1つでも失敗したら ZIP を作らず非ゼロ終了する。
 *
 * オプション:
 *  --allow-missing-report      品質レポート・マニュアル・インストーラーが無くても作る（試作用。販売用には使わない）
 *  --allow-missing-installers  インストーラーが無くても作る（Mac 以外の CI 用。販売用には使わない）
 */

import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';
import { checkMarkdownLinks, rewriteRelativeLinks, stripRepoOnly } from './lib/markdown.mjs';
import { scanForSecrets, loadLocalSecretValues } from './lib/secrets.mjs';
import { sha256File, walkFiles } from './lib/files.mjs';
import { buildLocalHtml } from './build-local-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'dist-delivery');
const PRODUCT_NAME = '相場カード比較ボード';
const ALLOW_MISSING_REPORT = process.argv.includes('--allow-missing-report');
/** インストーラーを作れない環境（Mac 以外の CI など）での確認用。販売用の納品物には使わない */
const ALLOW_MISSING_INSTALLERS = ALLOW_MISSING_REPORT || process.argv.includes('--allow-missing-installers');

/**
 * 購入者に渡すのは次の5ファイルだけ（初心者が迷わないように）。
 *  ① アプリのインストーラー（自分のパソコンに合う1つを使う） ② 画面写真入りマニュアル ③ 公開・改造する人向けの資料一式（ZIP）
 */
export const INSTALLERS = [
  { key: 'win', file: '①アプリ（Windows用）.exe', built: (v) => `soba-card-board-${v}-windows-setup.exe` },
  { key: 'mac-arm64', file: '①アプリ（Mac・Appleシリコン用）.dmg', built: (v) => `soba-card-board-${v}-mac-arm64.dmg` },
  { key: 'mac-x64', file: '①アプリ（Mac・Intel用）.dmg', built: (v) => `soba-card-board-${v}-mac-x64.dmg` },
];
export const MANUAL_FILE = '②マニュアル.pdf';
export const DETAIL_DIR = '③詳しい資料（公開・改造する人向け）';
export const DETAIL_ZIP = `${DETAIL_DIR}.zip`;
/** ③の中の、ブラウザで開く1ファイル版（自動取得なし） */
export const TOOL_FILE = 'ブラウザ版（自動取得なし）.html';
/** ココナラのトークルームで1回に送れる上限（200MB）より少し小さく */
export const MAX_DELIVERY_FILE_BYTES = 195 * 1024 * 1024;
export const deliveryDirName = (version) => `納品ファイル-v${version}`;

/** ZIP直下に置く購入者向け文書: [リポジトリ内のパス, ZIP内の名前] */
export const ROOT_DOCS = [
  ['docs/README_FIRST.md', 'README_FIRST.md'],
  ['docs/QUICK_START_BUYER.md', 'QUICK_START.md'],
  ['docs/user-guide.md', 'USER_GUIDE.md'],
  ['docs/deployment-guide.md', 'DEPLOY_GUIDE.md'],
  ['docs/SUPPORT_POLICY.md', 'SUPPORT_POLICY.md'],
  ['docs/PRIVACY_AND_DATA.md', 'PRIVACY_AND_DATA.md'],
  ['TERMS.md', 'TERMS.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
];

/** `source/` に入れるもの（リポジトリ直下からのパス。ディレクトリは配下すべて）。 */
export const SOURCE_ALLOWLIST = [
  'src/',
  'functions/',
  'e2e/',
  'e2e-desktop/',
  'electron/',
  'build-resources/',
  'electron-builder.yml',
  'playwright.desktop.config.ts',
  'tsconfig.electron.json',
  'scripts/build-desktop.mjs',
  'public/',
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
  'wrangler.jsonc',
  'worker.ts',
  'worker.test.ts',
  '.env.example',
  '.gitignore',
  '.nvmrc',
  '.node-version',
  'README.md',
  'TERMS.md',
  'CHANGELOG.md',
  // 購入者向け文書（販売者・開発AI向けの内部資料は含めない）
  'docs/README_FIRST.md',
  'docs/QUICK_START_BUYER.md',
  'docs/user-guide.md',
  'docs/deployment-guide.md',
  'docs/setup-guide.md',
  'docs/post-deploy-qa.md',
  'docs/known-limitations.md',
  'docs/buyer-handoff.md',
  'docs/SUPPORT_POLICY.md',
  'docs/PRIVACY_AND_DATA.md',
];

/** 許可リストに入っていても絶対に入れないもの（二重の安全装置）。 */
const NEVER_INCLUDE = [
  /(^|\/)\.env($|\.)(?!example)/,
  /(^|\/)\.dev\.vars/,
  /(^|\/)AGENTS\.md$/,
  /(^|\/)COPILOT_INSTRUCTIONS\.md$/,
  // 販売者用スクリプトは入れない（デスクトップ版のビルドに必要な1本だけ例外）
  /^scripts\/(?!build-desktop\.mjs$)/,
];

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

/** Git 管理下（追跡中＋未追跡で .gitignore 対象外）のファイル一覧。 */
function listCandidateFiles() {
  const list = (args) =>
    execFileSync('git', ['ls-files', ...args, '-z'], { cwd: REPO_ROOT })
      .toString('utf-8')
      .split('\0')
      .filter(Boolean);
  // 追跡中でも作業ツリーで削除済み（未コミット）のファイルは除く。
  const deleted = new Set(list(['-d']));
  return list(['-co', '--exclude-standard']).filter((file) => !deleted.has(file));
}

export function selectSourceFiles(candidates) {
  return candidates.filter((file) => {
    if (NEVER_INCLUDE.some((re) => re.test(file))) return false;
    return SOURCE_ALLOWLIST.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
  });
}

async function runPreChecks(version) {
  const errors = [];
  const readme = await fs.readFile(path.join(REPO_ROOT, 'README.md'), 'utf-8');
  if (!readme.includes(`v${version}`)) errors.push(`README.md にバージョン v${version} の記載がありません。`);
  const changelog = await fs.readFile(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf-8');
  if (!changelog.includes(`v${version}`)) errors.push(`CHANGELOG.md に v${version} の項目がありません。`);
  for (const required of ['package-lock.json', '.env.example', ...ROOT_DOCS.map(([from]) => from)]) {
    if (!(await pathExists(path.join(REPO_ROOT, required)))) errors.push(`${required} が見つかりません。`);
  }
  if (errors.length) {
    for (const e of errors) console.error(`[delivery] PRE-CHECK FAILED: ${e}`);
    fail(`事前チェックに ${errors.length} 件失敗しました。`);
  }
  log('事前チェック: OK');
}

async function stageSource(stagingDir, files) {
  const sourceDir = path.join(stagingDir, 'source');
  for (const rel of files) {
    const dest = path.join(sourceDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (rel.endsWith('.md')) {
      const markdown = await fs.readFile(path.join(REPO_ROOT, rel), 'utf-8');
      await fs.writeFile(dest, stripRepoOnly(markdown), 'utf-8');
    } else {
      await fs.copyFile(path.join(REPO_ROOT, rel), dest);
    }
  }

  // 納品物に含めない販売者用スクリプト（scripts/）を参照する npm スクリプトを取り除く。
  const pkgPath = path.join(sourceDir, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  const shipped = new Set(files);
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    const referenced = [...String(command).matchAll(/scripts\/[\w./-]+/g)].map((m) => m[0]);
    if (referenced.some((f) => !shipped.has(f)) || /playwright\.marketing/.test(command)) delete pkg.scripts[name];
  }
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
  return sourceDir;
}

async function stageRootDocs(stagingDir, shippedFiles) {
  const rootDocByRepoPath = new Map(ROOT_DOCS.map(([from, to]) => [path.join(REPO_ROOT, from), to]));
  const shipped = new Set(shippedFiles.map((f) => path.join(REPO_ROOT, f)));
  const shippedDirs = new Set(shippedFiles.flatMap((f) => {
    const parts = f.split('/');
    return parts.slice(0, -1).map((_, i) => path.join(REPO_ROOT, ...parts.slice(0, i + 1)));
  }));
  const unresolved = [];

  for (const [from, to] of ROOT_DOCS) {
    const srcFile = path.join(REPO_ROOT, from);
    const markdown = stripRepoOnly(await fs.readFile(srcFile, 'utf-8'));
    const rewritten = rewriteRelativeLinks(markdown, srcFile, (abs) => {
      if (rootDocByRepoPath.has(abs)) return rootDocByRepoPath.get(abs);
      if (shipped.has(abs) || shippedDirs.has(abs)) return `source/${path.relative(REPO_ROOT, abs).split(path.sep).join('/')}`;
      unresolved.push(`${from} → ${path.relative(REPO_ROOT, abs)}`);
      return null;
    });
    await fs.writeFile(path.join(stagingDir, to), rewritten, 'utf-8');
  }
  if (unresolved.length) {
    for (const u of unresolved) console.error(`[delivery] 納品物に無いファイルへのリンク: ${u}`);
    fail(`購入者向け文書に、納品物へ含まれないファイルへのリンクが ${unresolved.length} 件あります。`);
  }
}

async function stageStaticApp(stagingDir) {
  log('静的版（楽天連携なし）をビルド中...');
  execFileSync('npm', ['run', 'build:static'], { cwd: REPO_ROOT, stdio: 'inherit' });
  const built = path.join(REPO_ROOT, 'dist-static', 'client');
  if (!(await pathExists(path.join(built, 'index.html')))) fail('静的版のビルド結果（dist-static/client/index.html）がありません。');
  const dest = path.join(stagingDir, 'app-static');
  await fs.cp(built, dest, { recursive: true });
  await fs.rm(path.join(dest, '.assetsignore'), { force: true });
}

async function stageSamples(stagingDir) {
  const sampleDir = path.join(stagingDir, 'sample');
  await fs.mkdir(sampleDir, { recursive: true });
  const marketingDir = path.join(OUTPUT_DIR, 'marketing');
  let copied = 0;
  if (await pathExists(marketingDir)) {
    for (const name of await fs.readdir(marketingDir)) {
      if (!name.endsWith('.png')) continue;
      await fs.copyFile(path.join(marketingDir, name), path.join(sampleDir, name));
      copied += 1;
    }
  }
  await fs.writeFile(
    path.join(sampleDir, 'README.md'),
    copied
      ? '# 画面の見本\n\n実在しない商品データで撮影した画面の見本です（テーマ別・PC幅とスマホ幅）。\n'
      : '# 画面の見本\n\n画面の見本画像はこのバージョンには含まれていません。`app-static/` を公開すると実際の画面を確認できます。\n',
    'utf-8',
  );
  log(`見本画像: ${copied} 枚`);
}

/** 画面写真入りの操作・導入マニュアル（npm run marketing:capture で生成）を置く。 */
async function stageManual(destDir) {
  const manual = path.join(OUTPUT_DIR, 'manual', 'マニュアル.pdf');
  if (await pathExists(manual)) {
    await fs.copyFile(manual, path.join(destDir, MANUAL_FILE));
    return true;
  }
  if (!ALLOW_MISSING_REPORT) fail('マニュアル（dist-delivery/manual/マニュアル.pdf）がありません。npm run marketing:capture で生成してください。');
  return false;
}

/** デスクトップ版のインストーラー（npm run dist:desktop:mac / :win で生成）を置く。 */
async function stageInstallers(destDir, version) {
  let copied = 0;
  for (const installer of INSTALLERS) {
    const built = path.join(REPO_ROOT, 'release-desktop', installer.built(version));
    if (!(await pathExists(built))) {
      if (!ALLOW_MISSING_INSTALLERS) fail(`インストーラー（release-desktop/${installer.built(version)}）がありません。npm run dist:desktop:mac と npm run dist:desktop:win で作ってください。`);
      continue;
    }
    const { size } = await fs.stat(built);
    if (size > MAX_DELIVERY_FILE_BYTES) fail(`${installer.file} が ${Math.round(size / 1024 / 1024)}MB あり、ココナラで送れる大きさ（200MB）を超えます。`);
    await fs.copyFile(built, path.join(destDir, installer.file));
    copied += 1;
  }
  log(`インストーラー: ${copied} 個`);
}

async function stageQualityReport(stagingDir, version) {
  const reportPath = path.join(OUTPUT_DIR, 'QUALITY_REPORT.md');
  if (await pathExists(reportPath)) {
    const report = await fs.readFile(reportPath, 'utf-8');
    if (!report.includes(`v${version}`)) fail(`QUALITY_REPORT.md が v${version} のものではありません。npm run verify:all を実行し直してください。`);
    await fs.copyFile(reportPath, path.join(stagingDir, 'QUALITY_REPORT.md'));
    return;
  }
  if (!ALLOW_MISSING_REPORT) fail('品質レポート（dist-delivery/QUALITY_REPORT.md）がありません。npm run verify:all で生成してください。');
  await fs.writeFile(
    path.join(stagingDir, 'QUALITY_REPORT.md'),
    `# 品質チェック結果（v${version}）\n\nこのZIPは試作用で、自動品質チェックの結果は含まれていません。\n`,
    'utf-8',
  );
}

/** 全ファイルの SHA-256 一覧。パスは ZIP の一番上からの相対パスで、ファイル自体は ③ の中に置く。 */
async function writeChecksums(stagingDir, detailDir) {
  const files = (await walkFiles(stagingDir)).sort();
  const lines = [];
  for (const file of files) {
    const rel = path.relative(stagingDir, file).split(path.sep).join('/');
    lines.push(`${await sha256File(file)}  ${rel}`);
  }
  await fs.writeFile(path.join(detailDir, 'checksums.txt'), `${lines.join('\n')}\n`, 'utf-8');
}

async function zipDirectory(stagingDir, zipPath, rootFolderName) {
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.rm(zipPath, { force: true });
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', reject);
    archive.pipe(output);
    archive.directory(stagingDir, rootFolderName);
    archive.finalize();
  });
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
  const version = pkg.version;
  log(`バージョン: ${version}`);
  await runPreChecks(version);

  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coconala-tool-delivery-'));
  const detailDir = path.join(stagingRoot, DETAIL_DIR);
  await fs.mkdir(detailDir, { recursive: true });
  const deliveryDir = path.join(OUTPUT_DIR, deliveryDirName(version));

  try {
    const sourceFiles = selectSourceFiles(listCandidateFiles());
    log(`ソースをステージング中...（${sourceFiles.length} ファイル）`);
    await stageSource(detailDir, sourceFiles);

    log('購入者向け文書をステージング中（リンクをZIP構成へ書き換え）...');
    await stageRootDocs(detailDir, sourceFiles);
    await stageStaticApp(detailDir);
    await stageSamples(detailDir);
    await stageQualityReport(detailDir, version);
    await buildLocalHtml(path.join(detailDir, TOOL_FILE));
    await stageManual(detailDir);

    log('文書のリンク切れを検査中...');
    const linkProblems = await checkMarkdownLinks(detailDir);
    if (linkProblems.length) {
      for (const p of linkProblems) console.error(`[delivery] ${p}`);
      fail(`納品物の文書にリンク切れが ${linkProblems.length} 件あります。`);
    }
    log('リンク検査: OK');

    log('シークレットを走査中...');
    const offenders = await scanForSecrets(detailDir, await loadLocalSecretValues(REPO_ROOT));
    if (offenders.length) {
      for (const o of offenders) console.error(`[delivery] SECRET DETECTED: ${o}`);
      fail(`シークレットらしき値が ${offenders.length} 件見つかりました。納品物には含められません。`);
    }
    log('シークレット走査: OK（検出なし）');

    await writeChecksums(detailDir, detailDir);

    // 納品フォルダ: ①インストーラー ②マニュアル ③資料ZIP
    await fs.rm(deliveryDir, { recursive: true, force: true });
    await fs.mkdir(deliveryDir, { recursive: true });
    await stageInstallers(deliveryDir, version);
    await stageManual(deliveryDir);
    const zipPath = path.join(deliveryDir, DETAIL_ZIP);
    log(`ZIPを生成中: ${zipPath}`);
    await zipDirectory(detailDir, zipPath, DETAIL_DIR);
    const { size } = await fs.stat(zipPath);
    if (size > MAX_DELIVERY_FILE_BYTES) fail(`${DETAIL_ZIP} が 200MB を超えています。`);

    const lines = [];
    for (const name of (await fs.readdir(deliveryDir)).sort()) {
      lines.push(`${await sha256File(path.join(deliveryDir, name))}  ${name}`);
    }
    await fs.writeFile(path.join(OUTPUT_DIR, `納品ファイル-v${version}.sha256.txt`), `${lines.join('\n')}\n`, 'utf-8');
    log(`完了: ${path.relative(REPO_ROOT, deliveryDir)}/（${lines.length} ファイル）`);
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    if (!process.exitCode) process.exitCode = 1;
    console.error(`[delivery] 失敗しました: ${err.message}`);
  });
}
