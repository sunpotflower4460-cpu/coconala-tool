import { describe, it, expect } from 'vitest';
import { checkRakutenSearchQuery } from './searchQuery';

describe('checkRakutenSearchQuery（楽天の検索語ルール）', () => {
  it.each([
    ['PS5', 'PS5'],
    ['  Nintendo　Switch  2 ', 'Nintendo Switch 2'],
    ['本', '本'],
    ['4902370548495', '4902370548495'],
    ['ぷれすて', 'ぷれすて'],
  ])('%s は送れる', (input, value) => {
    expect(checkRakutenSearchQuery(input)).toEqual({ ok: true, value });
  });

  it.each([
    ['', 'empty'],
    ['\n\t', 'empty'],
    ['a', 'too_short'],
    ['あ', 'too_short'],
    ['a b', 'too_short'],
    ['x'.repeat(101), 'too_long'],
  ])('%j は %s で拒否する', (input, issue) => {
    expect(checkRakutenSearchQuery(input)).toEqual({ ok: false, issue });
  });
});
