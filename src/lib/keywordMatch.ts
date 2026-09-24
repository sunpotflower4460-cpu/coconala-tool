/**
 * サンプル・見本データ用の簡易キーワード一致。
 * 全角/半角・大文字/小文字を揃え、空白区切りの全語が対象文字列に含まれれば一致とする。
 * よく使う略称（PS5 ⇔ PlayStation 5 など）は同義語として同じ語に置き換えてから比べる。
 */
const SYNONYM_GROUPS: string[][] = [
  ['ps5', 'playstation 5', 'playstation5', 'プレイステーション5', 'プレイステーション 5', 'プレステ5'],
  ['walkman', 'ウォークマン'],
  ['switch', 'スイッチ'],
  ['nintendo', '任天堂', 'ニンテンドー'],
  ['sony', 'ソニー'],
];

// 長い表記から先に置き換える（「playstation 5」を「playstation5」より先に）。
const REPLACEMENTS = SYNONYM_GROUPS.flatMap(([canonical, ...variants]) =>
  variants.map((variant) => [variant, canonical] as const),
).sort((a, b) => b[0].length - a[0].length);

export function normalizeForMatch(value: string): string {
  let normalized = value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [variant, canonical] of REPLACEMENTS) {
    normalized = normalized.split(variant).join(canonical);
  }
  return normalized;
}

export function matchesAllKeywords(query: string, haystacks: Array<string | undefined>): boolean {
  const normalizedQuery = normalizeForMatch(query);
  if (!normalizedQuery) return true;
  const target = haystacks
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeForMatch)
    .join(' ');
  return normalizedQuery.split(' ').every((token) => target.includes(token));
}
