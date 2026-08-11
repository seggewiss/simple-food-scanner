/**
 * Calendar-day helpers. Diary dates are stored as local `YYYY-MM-DD` strings rather
 * than instants, so that "what did I eat on Tuesday" stays a calendar question and
 * entries do not slide across days on travel or a DST change.
 *
 * Kept free of database and React imports so it stays unit-testable in plain Node.
 */

export function todayIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shift a `YYYY-MM-DD` string by whole days, letting Date handle month/year rollover. */
export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return todayIso(new Date(year, month - 1, day + days));
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}
