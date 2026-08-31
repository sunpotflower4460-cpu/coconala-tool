import { describe, it, expect } from 'vitest';
import { toSafeHttpUrl, toSafeHttpsUrl, isSafeHttpUrl, isSafeHttpsUrl } from './safeUrl';

describe('toSafeHttpUrl', () => {
  it('https と http の絶対URLを許可する', () => {
    expect(toSafeHttpUrl('https://example.com/item')).toBe('https://example.com/item');
    expect(toSafeHttpUrl('http://example.com/item')).toBe('http://example.com/item');
  });

  it('javascript: / data: / 相対URLを拒否する', () => {
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(toSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(toSafeHttpUrl('/relative/path')).toBeUndefined();
    expect(toSafeHttpUrl('')).toBeUndefined();
    expect(toSafeHttpUrl(null)).toBeUndefined();
  });

  it('前後空白は trim したうえで判定する', () => {
    expect(toSafeHttpUrl('  https://example.com/a  ')).toBe('https://example.com/a');
  });
});

describe('toSafeHttpsUrl', () => {
  it('https のみ許可し、http 画像は拒否する', () => {
    expect(toSafeHttpsUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(toSafeHttpsUrl('http://cdn.example.com/a.jpg')).toBeUndefined();
    expect(toSafeHttpsUrl('javascript:alert(1)')).toBeUndefined();
  });
});

describe('type guards', () => {
  it('isSafeHttpUrl / isSafeHttpsUrl は判定結果と一致する', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true);
    expect(isSafeHttpUrl('javascript:void(0)')).toBe(false);
    expect(isSafeHttpsUrl('https://example.com/a.png')).toBe(true);
    expect(isSafeHttpsUrl('http://example.com/a.png')).toBe(false);
  });
});
