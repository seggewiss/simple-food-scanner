import { describe, expect, it } from 'vitest';

import { parseIsoDate, shiftIsoDate, todayIso } from './date';

describe('todayIso', () => {
  it('zero-pads month and day', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses local calendar fields, not UTC', () => {
    // A late-evening local time must not roll forward to the next UTC day.
    const lateEvening = new Date(2026, 7, 11, 23, 30);
    expect(todayIso(lateEvening)).toBe('2026-08-11');
  });
});

describe('shiftIsoDate', () => {
  it('moves forward and backward by whole days', () => {
    expect(shiftIsoDate('2026-08-11', 1)).toBe('2026-08-12');
    expect(shiftIsoDate('2026-08-11', -1)).toBe('2026-08-10');
  });

  it('rolls over month and year boundaries', () => {
    expect(shiftIsoDate('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(shiftIsoDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftIsoDate('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('parseIsoDate', () => {
  it('round-trips with todayIso', () => {
    expect(todayIso(parseIsoDate('2026-03-09'))).toBe('2026-03-09');
  });
});
