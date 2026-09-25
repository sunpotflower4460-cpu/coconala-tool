import { describe, it, expect } from 'vitest';
import { tileLayout } from './tiledWindows';

describe('tileLayout（ツールを左に残して右側を分割）', () => {
  const screen = { left: 0, top: 25, width: 1800, height: 1000 };
  it('4サイトは右 2/3 を 2×2 に分け、左 1/3 はツール用に空ける', () => {
    const tiles = tileLayout(4, screen);
    expect(tiles).toEqual([
      { left: 600, top: 25, width: 600, height: 500 },
      { left: 1200, top: 25, width: 600, height: 500 },
      { left: 600, top: 525, width: 600, height: 500 },
      { left: 1200, top: 525, width: 600, height: 500 },
    ]);
    expect(Math.min(...tiles.map((t) => t.left))).toBeGreaterThanOrEqual(600);
  });
  it('1サイトは右側いっぱい、5サイト以上は3列', () => {
    expect(tileLayout(1, screen)).toEqual([{ left: 600, top: 25, width: 1200, height: 1000 }]);
    expect(tileLayout(5, screen)[2]).toEqual({ left: 1400, top: 25, width: 400, height: 500 });
  });
});
