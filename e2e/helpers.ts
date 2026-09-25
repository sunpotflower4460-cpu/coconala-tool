import { expect, type Page } from '@playwright/test';

export const SEARCH_INPUT = '商品名・型番・JAN・URL';

/** 検索して、検索状態が反映されるまで待つ。 */
export async function search(page: Page, query: string) {
  await page.getByLabel(SEARCH_INPUT).fill(query);
  await page.getByRole('button', { name: 'まとめて探す' }).click();
  await expect(page.getByRole('button', { name: 'まとめて探す' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: /^検索結果 \(\d+件\)$/ })).toBeVisible();
}

export async function selectDataSource(page: Page, mode: 'rakuten_mock' | 'multi') {
  await page.getByLabel('データソースを選ぶ').selectOption(mode);
}

/** 検索結果のカード（article 要素）。 */
export function resultCards(page: Page) {
  return page.getByRole('article');
}

/** 比較ボードのカード（リスト項目）。 */
export function comparedCards(page: Page) {
  return page.getByRole('list', { name: '比較中のカード' }).getByRole('listitem');
}

export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'ページが横にはみ出していない').toBeLessThanOrEqual(clientWidth + 1);
}

/** CSV ダウンロードを実行して中身（BOM を含む生テキスト）を返す。 */
export async function downloadCsv(page: Page): Promise<{ filename: string; raw: Buffer; text: string }> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '比較中カードをCSV出力' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks);
  return { filename: download.suggestedFilename(), raw, text: raw.toString('utf-8') };
}

/** RFC4180 相当の最小 CSV パーサー（引用符・改行入りセルに対応）。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
