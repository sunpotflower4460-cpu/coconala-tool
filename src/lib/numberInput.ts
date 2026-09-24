/**
 * 金額・率の入力文字列を数値にする。全角数字・カンマ・「円」「%」「¥」を許容する。
 * 空欄は 0、数値として読めない場合は undefined（呼び出し側で直前の値を保つ）。
 */
export function parseNumberInput(text: string): number | undefined {
  const normalized = text
    .normalize('NFKC')
    .replace(/[,\s円%¥$]/g, '')
    .trim();
  if (normalized === '') return 0;
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.') return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}
