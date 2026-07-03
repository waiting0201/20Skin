/** 西元日期字串（ISO，如 "1978-02-01T00:00:00"）轉民國年顯示（如 "67-02-01"），比照舊系統 TaiwanCalendar。 */
export function toRocDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const rocYear = Number(y) - 1911;
  return `${rocYear}-${m}-${d}`;
}
