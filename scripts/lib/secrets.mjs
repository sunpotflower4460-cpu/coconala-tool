/**
 * 納品物・ビルド成果物に秘密情報が紛れ込んでいないかを調べる。
 *  1. 「秘密っぽい名前 = / : 値」の代入（.env・JSON・YAML・TS いずれの書き方も）
 *  2. 既知のトークン形式（GitHub / OpenAI / AWS / Slack / 秘密鍵）
 *  3. URL に直書きされた楽天の applicationId / accessKey
 *  4. 手元の .env* / .dev.vars* に書かれている実際の値そのもの
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from './files.mjs';

const SECRET_NAME = '[A-Za-z0-9_]*(?:SECRET|TOKEN|API_KEY|APP_ID|ACCESS_KEY|PASSWORD|PRIVATE_KEY|CLIENT_SECRET)[A-Za-z0-9_]*';
const ASSIGNMENT = new RegExp(`["']?(${SECRET_NAME})["']?\\s*[:=]\\s*(.+?)\\s*,?\\s*$`);
const TOKEN_PATTERNS = [
  [/ghp_[A-Za-z0-9]{36}/, 'GitHub token'],
  [/github_pat_[A-Za-z0-9_]{40,}/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API secret key (sk-)'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
];
const URL_KEY = /[?&](applicationId|accessKey)=([A-Za-z0-9_-]{12,})/;
const PLACEHOLDER_HINTS = ['your', 'example', 'placeholder', 'xxxx', 'changeme', 'dummy', 'sample', 'todo', 'insert', 'here', 'secret', 'test', 'e2e', 'fake', 'mock', '<', '>', '${', 'env.', 'process', 'undefined', 'null', 'string', '?', '('];
const MIN_SECRET_LENGTH = 8;

function looksLikePlaceholder(raw) {
  // 引用符で始まる値は、最初の引用符の中身だけを値とみなす（`'abc' },` → abc）。
  const quoted = raw.match(/^(['"`])(.*?)\1/);
  const value = (quoted ? quoted[2] : raw.replace(/[,;]+$/g, '')).trim();
  if (value.length < MIN_SECRET_LENGTH) return true;
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(value)) return true; // 日本語の案内文など
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(value) && /[a-z]/.test(value) && value.includes(".")) return true; // 変数参照（env.X など）
  const lower = value.toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => lower.includes(hint));
}

/** 手元の .env* / .dev.vars* に書かれた値（8文字以上）を集める。これらが納品物に出てきたら漏えい。 */
export async function loadLocalSecretValues(repoRoot) {
  const values = new Set();
  let entries = [];
  try {
    entries = await fs.readdir(repoRoot);
  } catch {
    return values;
  }
  for (const name of entries) {
    if (!/^\.env(\..+)?$|^\.dev\.vars(\..+)?$/.test(name) || name === '.env.example') continue;
    const content = await fs.readFile(path.join(repoRoot, name), 'utf-8').catch(() => '');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?[A-Za-z0-9_]+\s*=\s*["']?(.+?)["']?\s*$/);
      if (m && m[1].length >= MIN_SECRET_LENGTH) values.add(m[1]);
    }
  }
  return values;
}

export async function scanForSecrets(dir, localValues = new Set()) {
  const offenders = [];
  for (const file of await walkFiles(dir)) {
    if (path.basename(file) === 'checksums.txt') continue;
    const buffer = await fs.readFile(file);
    if (buffer.includes(0)) continue; // バイナリ
    const content = buffer.toString('utf-8');
    const rel = path.relative(dir, file);
    for (const value of localValues) {
      if (content.includes(value)) offenders.push(`${rel}: 手元の .env / .dev.vars と同じ値が含まれています`);
    }
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const where = `${rel}:${index + 1}`;
      const assignment = line.length < 500 ? line.match(ASSIGNMENT) : null;
      if (assignment && !looksLikePlaceholder(assignment[2])) offenders.push(`${where}: ${assignment[1]} に値が入っています`);
      for (const [re, label] of TOKEN_PATTERNS) if (re.test(line)) offenders.push(`${where}: ${label} らしき文字列`);
      const urlKey = line.match(URL_KEY);
      if (urlKey && !looksLikePlaceholder(urlKey[2])) offenders.push(`${where}: URL に ${urlKey[1]} が直書きされています`);
    });
  }
  return offenders;
}
