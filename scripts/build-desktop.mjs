#!/usr/bin/env node
/**
 * デスクトップアプリ（Electron）をビルドする: dist-desktop/
 *   renderer/        画面（vite build --mode desktop）
 *   electron/*.cjs   アプリ本体・preload（esbuild で1ファイルにまとめる）
 *   package.json     アプリ名・バージョン・入口（electron-builder と `electron dist-desktop` が読む）
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-desktop');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await fs.rm(OUT, { recursive: true, force: true });
run('npx', ['vite', 'build', '--mode', 'desktop', '--outDir', 'dist-desktop/renderer', '--emptyOutDir']);

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'warning',
  legalComments: 'none',
};
await build({ ...common, entryPoints: [path.join(ROOT, 'electron/main.ts')], outfile: path.join(OUT, 'electron/main.cjs') });
await build({ ...common, entryPoints: [path.join(ROOT, 'electron/preload.ts')], outfile: path.join(OUT, 'electron/preload.cjs') });

const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf-8'));
await fs.writeFile(
  path.join(OUT, 'package.json'),
  JSON.stringify(
    {
      name: 'soba-card-board',
      productName: 'SobaCardBoard',
      version: pkg.version,
      description: '画像つき価格カードで相場を比較するリサーチ補助ツール',
      author: 'coconala-tool',
      license: 'SEE LICENSE IN TERMS.md',
      main: 'electron/main.cjs',
    },
    null,
    2,
  ),
);
console.log('[build:desktop] dist-desktop/ を作成しました');
