const JST_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** ISO 日時を日本時間の「2026/09/24 22:39:35」形式にする。不正値は空文字。 */
export function formatJst(iso: string | null | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return JST_FORMATTER.format(new Date(time));
}
