#!/usr/bin/env node
/**
 * 静的版（dist-static/client）を「1つの HTML ファイルだけで動く版」にまとめる。
 * ダブルクリック（file://）で開いても動くよう、JS・CSS・テーマ初期化・アイコンをすべて HTML に埋め込む。
 * （file:// では外部の JS ファイルをモジュールとして読み込めないため、分割ファイルのままだと白い画面になる）
 *
 * 使い方: node scripts/build-local-html.mjs <出力ファイル>   ※先に npm run build:static を実行
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'dist-static', 'client');

/** `</script>` を含む文字列でもスクリプトが途中で終わらないようにする。 */
const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

export async function buildLocalHtml(outFile) {
  let html = await fs.readFile(path.join(CLIENT, 'index.html'), 'utf-8');

  // JS（モジュール）をインラインにする
  const scriptTags = [...html.matchAll(/<script type="module" crossorigin src="\/(assets\/[^"]+\.js)"><\/script>/g)];
  if (scriptTags.length !== 1) throw new Error(`JS の読み込みが1つではありません（${scriptTags.length}）。ビルド構成を確認してください。`);
  const js = await fs.readFile(path.join(CLIENT, scriptTags[0][1]), 'utf-8');
  html = html.replace(scriptTags[0][0], () => `<script type="module">${safeScript(js)}</script>`);

  // CSS をインラインにする
  for (const [tag, href] of html.matchAll(/<link rel="stylesheet" crossorigin href="\/(assets\/[^"]+\.css)">/g)) {
    const css = await fs.readFile(path.join(CLIENT, href), 'utf-8');
    html = html.replace(tag, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  }

  // テーマ初期化（初回描画前に実行する必要がある）
  const themeInit = await fs.readFile(path.join(CLIENT, 'theme-init.js'), 'utf-8');
  html = html.replace('<script src="/theme-init.js"></script>', () => `<script>${safeScript(themeInit)}</script>`);

  // アイコンを data URI に
  const favicon = await fs.readFile(path.join(CLIENT, 'favicon.svg'));
  html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);

  const leftovers = [...html.matchAll(/(?:src|href)="\/(?!\/)[^"]*"/g)].map((m) => m[0]);
  if (leftovers.length) throw new Error(`埋め込めていないファイル参照があります: ${leftovers.join(', ')}`);

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, html, 'utf-8');
  return outFile;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? path.join(ROOT, 'dist-local', '相場カード比較ボード.html');
  buildLocalHtml(out)
    .then((file) => console.log(`[local-html] ${path.relative(ROOT, file)}`))
    .catch((err) => {
      console.error(`[local-html] 失敗: ${err.message}`);
      process.exitCode = 1;
    });
}
