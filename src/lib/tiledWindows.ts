/**
 * 外部サイトの検索ページを、ツールの右側に格子状に並べた別ウィンドウで開く。
 * 画面の左 1/3 はツール用に空け、右 2/3 を開くサイトの数で分割する。
 * 同じサイトは前に開いたウィンドウを使い回す（押すたびにウィンドウが増えない）。
 * （Chrome は別サイトへ移動したウィンドウの名前を消すため、名前ではなく開いたウィンドウの参照で使い回す。）
 * 各サイトは他サイトへの埋め込みを禁止しているため、アプリの中には表示しない（中身も読み取らない）。
 */
export type Rect = { left: number; top: number; width: number; height: number };

export function tileLayout(count: number, screen: Rect, toolShare = 1 / 3): Rect[] {
  const toolWidth = Math.floor(screen.width * toolShare);
  const area = { left: screen.left + toolWidth, top: screen.top, width: screen.width - toolWidth, height: screen.height };
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(count / cols));
  const width = Math.floor(area.width / cols);
  const height = Math.floor(area.height / rows);
  return Array.from({ length: count }, (_, i) => ({
    left: area.left + (i % cols) * width,
    top: area.top + Math.floor(i / cols) * height,
    width,
    height,
  }));
}

function currentScreen(): Rect {
  const scr = window.screen as Screen & { availLeft?: number; availTop?: number };
  return {
    left: scr.availLeft ?? 0,
    top: scr.availTop ?? 0,
    width: scr.availWidth || window.innerWidth,
    height: scr.availHeight || window.innerHeight,
  };
}

/** まとめて開く。戻り値はブラウザにブロックされたウィンドウの数。 */
export function openTiled(targets: Array<{ id: string; url: string }>): number {
  const tiles = tileLayout(targets.length, currentScreen());
  let blocked = 0;
  targets.forEach((target, i) => {
    if (!openInTile(target, tiles[i])) blocked += 1;
  });
  return blocked;
}

/** 1サイトだけ、全体の並び（slot / total）の中の自分の位置で開く。 */
export function openInSlot(target: { id: string; url: string }, slot: number, total: number): boolean {
  const tiles = tileLayout(total, currentScreen());
  return openInTile(target, tiles[Math.min(slot, tiles.length - 1)]);
}

const openedWindows = new Map<string, Window>();

function openInTile(target: { id: string; url: string }, t: Rect): boolean {
  const existing = openedWindows.get(target.id);
  if (existing && !existing.closed) {
    try {
      existing.location.href = target.url;
      existing.focus();
      return true;
    } catch {
      openedWindows.delete(target.id);
    }
  }
  const win = window.open(target.url, `market-${target.id}`, `popup=yes,width=${t.width},height=${t.height},left=${t.left},top=${t.top}`);
  if (!win) return false;
  openedWindows.set(target.id, win);
  // opener は切らない: 切ると Chrome ではウィンドウとの関係が外れ、次回同じウィンドウを使い回せなくなる。
  // 開く先は利用者が選んだ大手サイト（メルカリ等）の検索ページに限られる。
  try {
    win.focus();
  } catch {
    // 別オリジンのウィンドウ操作が拒否されても開けてはいる
  }
  return true;
}
