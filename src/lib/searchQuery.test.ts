import { describe, it, expect } from 'vitest';
import { checkRakutenSearchQuery } from './searchQuery';

describe('checkRakutenSearchQuery（楽天の検索語ルール）', () => {
  it.each([
    ['PS5', 'PS5', 'PS5'],
    ['  Nintendo　Switch  2 ', 'Nintendo Switch 2', 'Nintendo Switch2'],
    ['Nintendo Switch 2 本体', 'Nintendo Switch 2 本体', 'Nintendo Switch2 本体'],
    ['a PS5', 'a PS5', 'aPS5'],
    ['iPhone 15 Pro', 'iPhone 15 Pro', 'iPhone 15 Pro'],
    ['本', '本', '本'],
    ['4902370548495', '4902370548495', '4902370548495'],
    ['ぷれすて', 'ぷれすて', 'ぷれすて'],
  ])('%s は送れる（楽天へは短い語をつなげて送る）', (input, value, keyword) => {
    expect(checkRakutenSearchQuery(input)).toEqual({ ok: true, value, keyword });
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
