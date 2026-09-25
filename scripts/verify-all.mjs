#!/usr/bin/env node
/**
 * 販売前の全自動チェック（`npm run verify:all`）。
 *
 *  1. 依存の脆弱性監査 → 型チェック → 単体テスト → 本番ビルド → 静的版ビルド
 *  2. E2E（偽楽天API＋本番同等 Worker、PC/タブレット/スマホ/iPhone、a11y、故障注入）
 *  3. 整合チェック（verify:release）
 *  4. 購入者向けの品質レポート dist-delivery/QUALITY_REPORT.md を作成（ZIP に同梱される）
 *  5. 納品ZIP生成（delivery:package）→ ZIP を展開して再検証（delivery:verify）
 *  6. 販売者向けの総合レポート dist-delivery/VERIFICATION_REPORT.md を作成
 *
 * どこかで失敗したら、それ以降の「納品ZIP生成」は行わず、失敗内容をレポートに残して非ゼロ終了する。
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-delivery');
const steps = [];

function nowJst() {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());
}

function runStep(label, command, args, { env = {}, capture = false } = {}) {
  const started = Date.now();
  console.log(`\n[verify:all] ▶ ${label}: ${command} ${args.join(' ')}`);
  const res = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  const ok = res.status === 0;
  const seconds = Math.round((Date.now() - started) / 1000);
  const output = capture ? `${res.stdout ?? ''}\n${res.stderr ?? ''}` : '';
  if (capture) process.stdout.write(output);
  steps.push({ label, ok, seconds });
  console.log(`[verify:all] ${ok ? '✔' : '✘'} ${label}（${seconds}秒）`);
  return { ok, output };
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return null;
  }
}

/** Playwright の JSON レポートから、端末（プロジェクト）ごとの合否数を集計する。 */
function summarizeE2E(report) {
  const byProject = new Map();
  const failures = [];
  function walk(suite, titles = []) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const project = t.projectName;
        const entry = byProject.get(project) ?? { passed: 0, failed: 0, skipped: 0, flaky: 0 };
        const status = t.status; // expected / unexpected / skipped / flaky
        if (status === 'expected') entry.passed += 1;
        else if (status === 'skipped') entry.skipped += 1;
        else if (status === 'flaky') entry.flaky += 1;
        else {
          entry.failed += 1;
          failures.push(`[${project}] ${[...titles, spec.title].join(' › ')}`);
        }
        byProject.set(project, entry);
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title].filter(Boolean));
  }
  for (const suite of report?.suites ?? []) walk(suite, [suite.title]);
  return { byProject, failures };
}

const PROJECT_LABELS = {
  'desktop-chromium': 'PC（1280px・Chromium）',
  'tablet-chromium': 'タブレット（768px・Chromium）',
  'mobile-chromium': 'スマホ（375px・Chromium）',
  'mobile-webkit': 'iPhone SE 相当（WebKit / Safari 系）',
};

function checkbox(ok) {
  return ok ? '✅' : '❌';
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  // 前回の結果を読み違えないよう、今回作り直すレポート類を先に消す。
  for (const stale of ['QUALITY_REPORT.md', 'VERIFICATION_REPORT.md', 'release-check.json', 'delivery-verify.json', 'unit-results.json', 'e2e-results.json']) {
    await fs.rm(path.join(OUT, stale), { force: true });
  }
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf-8'));
  const version = `v${pkg.version}`;

  const quality = [
    runStep('依存パッケージの脆弱性監査（高深刻度）', 'npm', ['audit', '--audit-level=high']),
    runStep('型チェック', 'npm', ['run', 'lint']),
    runStep('単体・画面部品テスト', 'npx', ['vitest', 'run', '--reporter=default', '--reporter=json', '--outputFile=dist-delivery/unit-results.json']),
    runStep('本番ビルド（Workers 版）', 'npm', ['run', 'build']),
    runStep('静的版ビルド', 'npm', ['run', 'build:static']),
    runStep('E2E（ブラウザ自動操作）', 'npx', ['playwright', 'test']),
    runStep('整合チェック（verify:release）', 'node', ['scripts/verify-release.mjs']),
    runStep('画面写真入りマニュアル・出品素材の生成', 'npx', ['playwright', 'test', '--config', 'scripts/playwright.marketing.config.ts']),
  ];
  const qualityOk = quality.every((s) => s.ok);

  const unit = await readJson(path.join(OUT, 'unit-results.json'));
  const e2e = await readJson(path.join(OUT, 'e2e-results.json'));
  const release = await readJson(path.join(OUT, 'release-check.json'));
  const { byProject, failures: e2eFailures } = summarizeE2E(e2e);
  const e2eTotal = [...byProject.values()].reduce((sum, p) => sum + p.passed, 0);

  const qualityReport = [
    `# 品質チェック結果（${version}）`,
    '',
    `実行日時: ${nowJst()}（日本時間） / 実行環境: Node.js ${process.version}・${os.type()} ${os.arch()}`,
    '',
    'このツールを納品する前に、以下のチェックをすべて自動で実行した結果です。',
    `結果: **${qualityOk ? 'すべて合格' : '不合格の項目があります'}**`,
    '',
    '## 実行したチェック',
    '',
    '| チェック | 結果 |',
    '|---|---|',
    ...steps.map((s) => `| ${s.label} | ${checkbox(s.ok)} |`),
    '',
    '## テストの件数',
    '',
    `- 単体・画面部品テスト: ${unit ? `${unit.numPassedTests} / ${unit.numTotalTests} 件 合格` : '集計なし'}`,
    `- ブラウザ自動操作テスト（E2E）: ${e2eTotal} 件 合格`,
    '',
    '| 画面・端末 | 合格 | 不合格 | 対象外 |',
    '|---|---|---|---|',
    ...[...byProject.entries()].map(([name, p]) => `| ${PROJECT_LABELS[name] ?? name} | ${p.passed} | ${p.failed + p.flaky} | ${p.skipped} |`),
    '',
    '## ブラウザ自動操作テストで確認していること',
    '',
    '- 検索 → 比較に追加 → 利益計算（手数料・送料込み）→ 元ページリンク → CSV 出力（中身・文字化け対策・数式の無害化）',
    '- 手動追加（全角・「万円」表記の価格、ドル建ての円換算、不正なURLの拒否、重複の注意）',
    '- リサーチ履歴（保存・再読込後の再開・削除の確認・20件の上限）、比較ボードの保存、テーマの切り替えと保持',
    '- 楽天市場: 本番と同じサーバー処理を使い、実データ表示と、キー未設定・キー誤り・アクセス集中・楽天側の不具合・応答遅延・',
    '  壊れた応答・該当なし・使えない検索語・オフラインのときに、落ちずに理由を表示すること（楽天を模した検証用サーバーを使用）',
    '- PC・タブレット・スマホ・iPhone 相当の画面幅で、横にはみ出さないこと・ボタンが押しやすい大きさであること',
    '- アクセシビリティ（WCAG 2.1 AA、4テーマ）・キーボード操作・「動きを減らす」設定への対応',
    '- 保存が禁止されたブラウザ・保存容量不足・画像やフォントが読めない場合でも使えること',
    '- セキュリティヘッダー（他サイトへの埋め込み禁止・読み込み元の制限）と、API の不正な呼び出しの拒否',
    '',
    '## 整合チェック',
    '',
    ...(release?.results ?? []).map((r) => `- ${checkbox(r.ok)} ${r.name}`),
    '',
    '## 自動では確認できないこと',
    '',
    '- 購入者ご自身の楽天アプリID・アクセスキーでの実際の検索（公開後に1回ご確認ください。手順は `DEPLOY_GUIDE.md`）',
    '- お手持ちのスマートフォン実機での見え方',
    '',
  ].join('\n');

  if (!qualityOk) {
    await fs.writeFile(path.join(OUT, 'VERIFICATION_REPORT.md'), `${qualityReport}\n## 失敗したテスト\n\n${e2eFailures.map((f) => `- ${f}`).join('\n')}\n`);
    console.error('\n[verify:all] 品質チェックに失敗したため、納品ZIPは作りません。dist-delivery/VERIFICATION_REPORT.md を確認してください。');
    process.exitCode = 1;
    return;
  }
  await fs.writeFile(path.join(OUT, 'QUALITY_REPORT.md'), qualityReport);

  const packaged = runStep('納品ZIPの生成（delivery:package）', 'node', ['scripts/create-delivery-package.mjs']);
  const verified = packaged.ok ? runStep('納品ZIPの展開・再検証（delivery:verify）', 'node', ['scripts/verify-delivery.mjs']) : { ok: false };
  const delivery = await readJson(path.join(OUT, 'delivery-verify.json'));
  const allOk = qualityOk && packaged.ok && verified.ok;

  const marketingDir = path.join(OUT, 'marketing');
  const marketing = await fs.readdir(marketingDir).catch(() => []);
  const zipName = `相場カード比較ボード-${version}.zip`;

  const verification = [
    `# 総合検証レポート（${version}・販売者用）`,
    '',
    `実行日時: ${nowJst()}（日本時間） / 結果: **${allOk ? 'すべて合格' : '不合格あり'}**`,
    '',
    '## 手順ごとの結果',
    '',
    '| 手順 | 結果 | 所要時間 |',
    '|---|---|---|',
    ...steps.map((s) => `| ${s.label} | ${checkbox(s.ok)} | ${s.seconds}秒 |`),
    '',
    '## 納品ZIPの検証（購入者と同じ立場で展開して確認）',
    '',
    ...(delivery?.results ?? []).map((r) => `- ${checkbox(r.ok)} ${r.name}${r.ok || !r.detail ? '' : `\n\n  \`\`\`\n  ${r.detail.split('\n').join('\n  ')}\n  \`\`\``}`),
    '',
    '## 成果物',
    '',
    `- 納品ZIP: \`dist-delivery/${zipName}\``,
    `- 出品用素材: ${marketing.length ? `\`dist-delivery/marketing/\`（${marketing.length} ファイル）` : '未生成（`npm run marketing:capture`）'}`,
    '',
    '## 残る人手の作業',
    '',
    '`docs/MANUAL_STEPS_SALES.md` を参照（実キーでの1回の検索確認・スマホ実機・出品物・価格と規約の判断）。',
    '',
    '---',
    '',
    qualityReport.replace(/^# .*\n/, '## 品質チェックの詳細（購入者向けレポートと同じ内容）\n'),
  ].join('\n');
  await fs.writeFile(path.join(OUT, 'VERIFICATION_REPORT.md'), verification);

  console.log(`\n[verify:all] ${allOk ? '✔ すべて合格' : '✘ 不合格あり'} — dist-delivery/VERIFICATION_REPORT.md`);
  if (!allOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`[verify:all] 失敗しました: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
