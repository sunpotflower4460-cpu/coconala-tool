/**
 * `/api/*`（楽天・Yahoo!ショッピング・eBay のサーバー側プロキシ）で共通に使う部品。
 */
import { stripControlChars } from '../../src/lib/searchQuery';

const MAX_URL_LENGTH = 2000;

export const API_SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
} as const;

export const RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  ...API_SECURITY_HEADERS,
} as const;

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return stripControlChars(value).slice(0, maxLength);
}

/**
 * ブラウザからの別origin利用を抑止する。
 * `Origin` が無いCLI等は許可するため、公開プロキシの濫用対策は `worker.ts` のレート制限と併用する。
 */
export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'same-site' || fetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function parseLimit(value: string | null, { min = 1, max = 30, fallback = 8 } = {}): number {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch {
    return false;
  }
}

export class UpstreamTooLargeError extends Error {}

/** 本文をサイズ上限つきで読む。上限超過は UpstreamTooLargeError。 */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers?.get?.('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) throw new UpstreamTooLargeError();
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new UpstreamTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** E2E の偽サーバーへの差し替えは、フラグ＋ループバックURLのときだけ有効。本番設定では絶対に効かない。 */
export function resolveTestOverride(
  env: { E2E_FAKE_UPSTREAM?: string },
  override: string | undefined,
  productionUrl: string,
): string {
  const value = override?.trim();
  if (env.E2E_FAKE_UPSTREAM === '1' && value && isLoopbackUrl(value)) return value;
  return productionUrl;
}
