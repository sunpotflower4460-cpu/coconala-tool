import { MAX_URL_LENGTH } from './limits';

function parseAbsoluteUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return undefined;
  try {
    return new URL(trimmed);
  } catch {
    return undefined;
  }
}

/** リンク先として許可する http/https のみ。javascript:/data: 等は拒否する。 */
export function toSafeHttpUrl(value: unknown): string | undefined {
  const parsed = parseAbsoluteUrl(value);
  if (!parsed) return undefined;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  return parsed.href;
}

/** 画像読み込み用。混在コンテンツと javascript: を避けるため https のみ。 */
export function toSafeHttpsUrl(value: unknown): string | undefined {
  const parsed = parseAbsoluteUrl(value);
  if (!parsed || parsed.protocol !== 'https:') return undefined;
  return parsed.href;
}

export function isSafeHttpUrl(value: unknown): value is string {
  return Boolean(toSafeHttpUrl(value));
}

export function isSafeHttpsUrl(value: unknown): value is string {
  return Boolean(toSafeHttpsUrl(value));
}
