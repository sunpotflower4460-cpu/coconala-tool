/**
 * Markdown の相対リンク・見出しアンカーを扱う小さなユーティリティ（納品前チェック用）。
 * 見出しアンカーは GitHub と同じ規則（小文字化・記号除去・空白→ハイフン・重複に連番）で作る。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const CODE_FENCE = /^(```|~~~)/;

/** コードブロックを除いた本文の行を返す。 */
function proseLines(markdown) {
  const lines = markdown.split('\n');
  const result = [];
  let inFence = false;
  for (const line of lines) {
    if (CODE_FENCE.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) result.push(line);
  }
  return result;
}

export function githubSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~[\]()]/g, (ch) => (ch === '_' ? '_' : ''))
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

export function headingAnchors(markdown) {
  const anchors = new Set();
  const counts = new Map();
  for (const line of proseLines(markdown)) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const base = githubSlug(m[1]);
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

/** `[text](target)` 形式のリンク先（外部URL・mailto を除く）を返す。 */
export function relativeLinks(markdown) {
  const links = [];
  for (const line of proseLines(markdown)) {
    const withoutInlineCode = line.replace(/`[^`]*`/g, (code) => (code.includes('](') ? code : ' '.repeat(code.length)));
    for (const m of withoutInlineCode.matchAll(/\[(?:[^\]]|\][^(])*?\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|tel:)/i.test(target)) continue;
      links.push(target);
    }
  }
  return links;
}

/**
 * ディレクトリ配下の全 .md の相対リンクを検査する。
 * 戻り値: 壊れたリンクの説明の配列（空なら問題なし）。
 */
export async function checkMarkdownLinks(rootDir, { ignore = [] } = {}) {
  const problems = [];
  const files = await listMarkdown(rootDir, ignore);
  const anchorCache = new Map();
  async function anchorsOf(file) {
    if (!anchorCache.has(file)) anchorCache.set(file, headingAnchors(await fs.readFile(file, 'utf-8')));
    return anchorCache.get(file);
  }
  for (const file of files) {
    const markdown = await fs.readFile(file, 'utf-8');
    for (const link of relativeLinks(markdown)) {
      const [rawPath, anchor] = link.split('#');
      const decodedPath = decodeURIComponent(rawPath);
      const target = rawPath ? path.resolve(path.dirname(file), decodedPath) : file;
      const rel = path.relative(rootDir, file);
      let stat;
      try {
        stat = await fs.stat(target);
      } catch {
        problems.push(`${rel}: リンク切れ → ${link}`);
        continue;
      }
      if (anchor && stat.isFile() && target.endsWith('.md')) {
        const anchors = await anchorsOf(target);
        if (!anchors.has(decodeURIComponent(anchor))) problems.push(`${rel}: 見出しが見つからない → ${link}`);
      }
    }
  }
  return problems;
}

async function listMarkdown(dir, ignore) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (ignore.includes(entry.name) || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMarkdown(full, ignore)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Markdown 内の相対リンクを書き換える。`mapTarget(absPathOfTarget)` が新しい相対パス（またはnull=変更なし）を返す。
 */
export function rewriteRelativeLinks(markdown, fromFile, mapTarget) {
  return markdown.replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (whole, link, title) => {
    if (/^(https?:|mailto:|tel:|#)/i.test(link)) return whole;
    const [rawPath, anchor] = link.split('#');
    const abs = path.resolve(path.dirname(fromFile), decodeURIComponent(rawPath));
    const mapped = mapTarget(abs);
    if (mapped === null || mapped === undefined) return whole;
    return `](${encodeURI(mapped)}${anchor ? `#${anchor}` : ''}${title})`;
  });
}

/** `<!-- repo-only:start -->` 〜 `<!-- repo-only:end -->` を取り除く（納品物用）。 */
export function stripRepoOnly(markdown) {
  return markdown.replace(/<!-- repo-only:start -->[\s\S]*?<!-- repo-only:end -->\n?/g, '');
}
