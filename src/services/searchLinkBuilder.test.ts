import { describe, it, expect } from 'vitest';
import { buildSearchLinks } from './searchLinkBuilder';

describe('buildSearchLinks', () => {
  it('空・空白のみではリンクを作らない', () => {
    expect(buildSearchLinks('')).toEqual([]);
    expect(buildSearchLinks('   ')).toEqual([]);
  });

  it('特殊文字を encodeURIComponent し、URL に生の & や " を埋め込まない', () => {
    const query = 'PS5&foo="bar"<script>';
    const links = buildSearchLinks(query);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const encoded = encodeURIComponent(query.trim());
      expect(link.url).toContain(encoded);
      expect(link.url).not.toContain('PS5&foo=');
      expect(link.url).not.toContain('<script>');
    }
  });

  it('すべてのショートカットは https の絶対URL', () => {
    for (const link of buildSearchLinks('PS5')) {
      expect(link.url.startsWith('https://')).toBe(true);
    }
  });
});
