#!/usr/bin/env node
/**
 * 販売前の整合チェック（`npm run verify:release`）。人が目で確認していた項目を機械的に確かめる。
 * 先に `npm run build` と `npm run build:static` を実行しておくこと（verify:all は自動で実行する）。
 * 結果は dist-delivery/release-check.json に保存する。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMarkdownLinks } from './lib/markdown.mjs';
import { loadLocalSecretValues, scanForSecrets } from './lib/secrets.mjs';
import { walkFiles } from './lib/files.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFile(path.join(ROOT, rel), 'utf-8');

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`[verify:release] ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const BUYER_DOCS = [
  'README.md',
  'TERMS.md',
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
  'docs/coconala-listing-copy.md',
];

// 誇張・断定表現（否定文での言及は除く）
const OVERCLAIMS = ['完全自動', '自動最安値', '最安値保証', '必ず儲かる', '確実に利益', '確実に稼げ', '実API接続済み', '全サイト自動取得'];
const NEGATION = /ありません|しません|できません|ではありません|行いません|禁止|誇張|ない/;
// 購入者向け文書に残してはいけない下書き記号
const PLACEHOLDERS = [/\bTODO\b/, /\bTBD\b/, /\bFIXME\b/, /XXX(?!X)/, /〇〇/, /【要記入】/, /\?\?\?/];
// 画面に出してはいけない裏事情の言葉（AGENTS.md: 初心者向けに専門用語を表に出しすぎない）
const UI_JARGON = ['モック', '上流', 'スクレイピング', 'Pages Functions', 'フォールバック', 'レート超過', 'プロキシ'];

async function sourceFiles(dir, filter) {
  return (await walkFiles(path.join(ROOT, dir))).filter(filter);
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*');
}

async function main() {
  const pkg = JSON.parse(await read('package.json'));
  const v = `v${pkg.version}`;

  // 1. バージョン表記
  const versionTargets = {
    'README.md': (await read('README.md')).includes(v),
    'CHANGELOG.md（先頭の項目）': (await read('CHANGELOG.md')).split('\n').find((l) => l.startsWith('## '))?.includes(v) ?? false,
    'docs/PRODUCTION_FAILURE_RISK_MATRIX.md': (await read('docs/PRODUCTION_FAILURE_RISK_MATRIX.md')).includes(v),
    'docs/coconala-listing-copy.md': (await read('docs/coconala-listing-copy.md')).includes(v),
  };
  const badVersions = Object.entries(versionTargets).filter(([, ok]) => !ok).map(([k]) => k);
  record(`バージョン ${v} が文書とそろっている`, badVersions.length === 0, badVersions.join(', '));

  // 2. リンク切れ（リポジトリ全体の Markdown）
  const links = await checkMarkdownLinks(ROOT, {
    ignore: ['node_modules', 'dist', 'dist-e2e', 'dist-static', 'dist-delivery', 'test-results', 'playwright-report', 'archive'],
  });
  record('Markdown のリンク・見出しアンカーが切れていない', links.length === 0, links.slice(0, 5).join(' / '));

  // 3. 誇張表現・下書き記号
  const overclaims = [];
  const placeholders = [];
  for (const rel of BUYER_DOCS) {
    const lines = (await read(rel)).split('\n');
    lines.forEach((line, i) => {
      for (const word of OVERCLAIMS) if (line.includes(word) && !NEGATION.test(line)) overclaims.push(`${rel}:${i + 1} ${word}`);
      for (const re of PLACEHOLDERS) if (re.test(line)) placeholders.push(`${rel}:${i + 1}`);
    });
  }
  const uiFiles = await sourceFiles('src', (f) => /\.(tsx?|ts)$/.test(f) && !/\.test\./.test(f));
  for (const file of uiFiles) {
    const lines = (await fs.readFile(file, 'utf-8')).split('\n');
    lines.forEach((line, i) => {
      if (isCommentLine(line)) return;
      for (const word of OVERCLAIMS) if (line.includes(word) && !NEGATION.test(line)) overclaims.push(`${path.relative(ROOT, file)}:${i + 1} ${word}`);
    });
  }
  record('誇張・断定表現が無い（完全自動・最安値保証 等）', overclaims.length === 0, overclaims.slice(0, 5).join(' / '));
  record('購入者向け文書に下書き記号（TODO・〇〇 等）が無い', placeholders.length === 0, placeholders.slice(0, 5).join(' / '));

  const jargon = [];
  for (const file of uiFiles) {
    const lines = (await fs.readFile(file, 'utf-8')).split('\n');
    lines.forEach((line, i) => {
      if (isCommentLine(line)) return;
      const visible = line.replace(/\/\/.*$/, '');
      for (const word of UI_JARGON) if (visible.includes(word)) jargon.push(`${path.relative(ROOT, file)}:${i + 1} ${word}`);
    });
  }
  record('画面の文言に専門用語（モック・上流・プロキシ 等）が出ていない', jargon.length === 0, jargon.slice(0, 5).join(' / '));

  // 4. 秘密情報がビルド成果物・リポジトリに無い
  const localValues = await loadLocalSecretValues(ROOT);
  for (const dir of ['dist/client', 'dist-static/client']) {
    const exists = await fs.stat(path.join(ROOT, dir)).then(() => true).catch(() => false);
    if (!exists) {
      record(`${dir} に秘密情報が無い`, false, `${dir} がありません（先にビルドしてください）`);
      continue;
    }
    const found = await scanForSecrets(path.join(ROOT, dir), localValues);
    const text = (await Promise.all((await walkFiles(path.join(ROOT, dir))).map((f) => fs.readFile(f, 'utf-8').catch(() => '')))).join('\n');
    if (/SERVER_RAKUTEN|applicationId=|accessKey=/.test(text)) found.push('楽天キーの変数名・パラメータが画面ファイルに含まれています');
    record(`画面のビルド成果物（${dir}）に楽天キー・秘密情報が無い`, found.length === 0, found.slice(0, 3).join(' / '));
  }
  const repoSecrets = [];
  for (const dir of ['src', 'functions', 'e2e', 'public', 'docs', 'scripts']) {
    repoSecrets.push(...(await scanForSecrets(path.join(ROOT, dir), localValues)).map((s) => `${dir}/${s}`));
  }
  for (const file of ['wrangler.jsonc', 'worker.ts', 'worker.test.ts', '.env.example', 'README.md', 'package.json']) {
    const content = await read(file);
    for (const value of localValues) if (content.includes(value)) repoSecrets.push(`${file}: 手元の実キーと同じ値`);
  }
  record('リポジトリ（Git 管理対象）に実キー・トークンが無い', repoSecrets.length === 0, repoSecrets.slice(0, 5).join(' / '));

  // 5. スクレイピング・直接取得をしていない
  const scraping = [];
  const serverAndUi = [...uiFiles, ...(await sourceFiles('functions', (f) => f.endsWith('.ts') && !f.includes('.test.'))), path.join(ROOT, 'worker.ts')];
  for (const file of serverAndUi) {
    const content = await fs.readFile(file, 'utf-8');
    if (/from ['"](puppeteer|playwright|cheerio|jsdom|node-html-parser)/.test(content)) scraping.push(`${path.relative(ROOT, file)}: HTML解析/ブラウザ自動操作ライブラリ`);
    // 通信先は、画面→自サーバーの /api/*（officialFetch の `${path}`）と、サーバー→各社の公式API（endpoint・OAuth）だけ。
    // `async fetch(` は Worker の入口の定義なので除く。
    for (const m of content.matchAll(/(?<!async\s)\bfetch\(\s*([^,]+)/g)) {
      const target = m[1].trim();
      if (!/^`\/api\/rakuten|^`\$\{path\}\?q=|^endpoint\.toString\(\)|^resolveTestOverride\(env/.test(target)) {
        scraping.push(`${path.relative(ROOT, file)}: fetch(${target})`);
      }
    }
    // 画面側の /api/* の呼び先は、公式APIプロキシの3つだけ
    for (const m of content.matchAll(/'(\/api\/[a-z]+)'/g)) {
      if (!['/api/rakuten', '/api/yahoo', '/api/ebay'].includes(m[1])) scraping.push(`${path.relative(ROOT, file)}: 未知のAPI ${m[1]}`);
    }
  }
  record('外部サイトを直接取得・解析するコードが無い（楽天は公式APIのみ）', scraping.length === 0, scraping.join(' / '));

  // 6. 楽天API・Workers・セキュリティ設定
  const rakuten = await read('functions/api/rakuten.ts');
  record(
    '楽天は新API（openapi.rakuten.co.jp）を使い、アクセスキーを送る',
    /https:\/\/openapi\.rakuten\.co\.jp\/ichibams\/api\/IchibaItem\/Search\/\d{8}/.test(rakuten) &&
      !/app\.rakuten\.co\.jp\/services/.test(rakuten) &&
      rakuten.includes("searchParams.set('accessKey'"),
  );
  const yahoo = await read('functions/api/yahoo.ts');
  const ebay = await read('functions/api/ebay.ts');
  record(
    'Yahoo!ショッピング・eBay は公式API（shopping.yahooapis.jp / api.ebay.com）だけを使う',
    yahoo.includes("'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch'") &&
      ebay.includes("'https://api.ebay.com/buy/browse/v1/item_summary/search'") &&
      ebay.includes("'https://api.ebay.com/identity/v1/oauth2/token'"),
  );
  const wrangler = await read('wrangler.jsonc');
  record('Workers にレート制限（ratelimits）が設定されている', /"ratelimits"/.test(wrangler) && /RAKUTEN_RATE_LIMITER/.test(await read('worker.ts')));
  const headers = await read('public/_headers');
  record(
    '画面に CSP・クリックジャッキング対策ヘッダーが付く（public/_headers）',
    /Content-Security-Policy:.*frame-ancestors 'none'/.test(headers) && /X-Frame-Options: DENY/.test(headers) && /X-Content-Type-Options: nosniff/.test(headers),
  );
  const appShell = await read('src/components/AppShell.tsx');
  record(
    '楽天ウェブサービスのクレジット表記（改変なし）が画面にある',
    appShell.includes('<a href="https://developers.rakuten.com/" target="_blank">Supported by Rakuten Developers</a>'),
  );
  record(
    'Yahoo! JAPAN Web API のクレジット表記（改変なし）が画面にある',
    appShell.includes('<a href="https://developer.yahoo.co.jp/sitemap/">Webサービス by Yahoo! JAPAN</a>'),
  );
  const envExample = await read('.env.example');
  record(
    '.env.example に楽天・Yahoo!・eBay の設定項目があり、値は空',
    ['SERVER_RAKUTEN_APP_ID', 'SERVER_RAKUTEN_ACCESS_KEY', 'SERVER_YAHOO_CLIENT_ID', 'SERVER_EBAY_CLIENT_ID', 'SERVER_EBAY_CLIENT_SECRET'].every((name) =>
      new RegExp(`^${name}=$`, 'm').test(envExample),
    ),
  );

  // 7. 本番故障リスク表に未対策の P0 が残っていない
  const matrix = await read('docs/PRODUCTION_FAILURE_RISK_MATRIX.md');
  const openP0 = [...matrix.matchAll(/^## (\S+) .*\n\n- 重大度: P0\n- 状態: ([^\n]+)/gm)].filter(([, , state]) => /Open/.test(state) && !/External/.test(state)).map(([, id]) => id);
  record('本番故障リスク表に未対策の P0 が無い', openP0.length === 0, openP0.join(', '));

  await fs.mkdir(path.join(ROOT, 'dist-delivery'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'dist-delivery', 'release-check.json'), JSON.stringify({ version: pkg.version, results }, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`[verify:release] ${failed.length} 件失敗しました。`);
    process.exitCode = 1;
  } else {
    console.log(`[verify:release] すべて合格（${results.length} 項目）`);
  }
}

main().catch((err) => {
  console.error(`[verify:release] 失敗しました: ${err.message}`);
  process.exitCode = 1;
});
