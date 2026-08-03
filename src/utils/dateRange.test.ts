import {
  toYmd,
  parseYmd,
  addDays,
  startOfIsoWeek,
  weekDays,
  monthGrid,
  formatDayHeading,
  formatDayStamp,
  formatDayCompact,
  formatMonthLabel,
} from './dateRange';

/** Local-midnight date, matching how every helper here builds dates. */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('toYmd / parseYmd', () => {
  it('round-trips', () => {
    expect(toYmd(parseYmd('2025-04-23'))).toBe('2025-04-23');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toYmd(d(2025, 1, 5))).toBe('2025-01-05');
  });

  // `new Date('2025-04-23')` parses as UTC midnight, which is 05:30 IST the same day — but for any
  // timezone west of Greenwich it lands on the 22nd. Building from parts avoids the whole class.
  it('parses to local midnight, not UTC', () => {
    const parsed = parseYmd('2025-04-23');
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(3);
    expect(parsed.getDate()).toBe(23);
    expect(parsed.getHours()).toBe(0);
  });
});

describe('addDays', () => {
  it('rolls over a month boundary', () => {
    expect(toYmd(addDays(d(2025, 4, 30), 1))).toBe('2025-05-01');
  });

  it('rolls over a year boundary backwards', () => {
    expect(toYmd(addDays(d(2025, 1, 1), -1))).toBe('2024-12-31');
  });

  it('handles a leap day', () => {
    expect(toYmd(addDays(d(2024, 2, 28), 1))).toBe('2024-02-29');
  });
});

describe('startOfIsoWeek', () => {
  // Sunday is the trap: getDay() returns 0, so a naive `-getDay()` jumps forward a week.
  it('treats Sunday as the last day of its week', () => {
    expect(toYmd(startOfIsoWeek(d(2025, 4, 27)))).toBe('2025-04-21');
  });

  it('is a no-op on a Monday', () => {
    expect(toYmd(startOfIsoWeek(d(2025, 4, 21)))).toBe('2025-04-21');
  });

  it('reaches back across a month boundary', () => {
    expect(toYmd(startOfIsoWeek(d(2025, 5, 1)))).toBe('2025-04-28');
  });
});

describe('weekDays', () => {
  it('returns Monday through Sunday', () => {
    const week = weekDays(d(2025, 4, 23)).map(toYmd);
    expect(week).toEqual([
      '2025-04-21',
      '2025-04-22',
      '2025-04-23',
      '2025-04-24',
      '2025-04-25',
      '2025-04-26',
      '2025-04-27',
    ]);
  });
});

describe('monthGrid', () => {
  // April 2025 starts on a Tuesday, so the grid pads back into March.
  it('pads the leading days from the previous month', () => {
    const { days, from } = monthGrid(2025, 3);
    expect(from).toBe('2025-03-31');
    expect(toYmd(days[0])).toBe('2025-03-31');
    expect(toYmd(days[1])).toBe('2025-04-01');
  });

  it('is always 42 cells so the grid never changes height', () => {
    expect(monthGrid(2025, 3).days).toHaveLength(42);
    expect(monthGrid(2025, 1).days).toHaveLength(42); // February
    expect(monthGrid(2024, 1).days).toHaveLength(42); // leap February
  });

  // September 2025 starts on a Monday — no leading pad, but the grid still runs 42 days.
  it('needs no leading pad when the month starts on a Monday', () => {
    const { days, from, to } = monthGrid(2025, 8);
    expect(from).toBe('2025-09-01');
    expect(toYmd(days[0])).toBe('2025-09-01');
    expect(to).toBe('2025-10-12');
  });

  // The bounds must cover the padded grid, not the calendar month, or the grey leading/trailing
  // squares render without dots and look empty when they are not.
  it('reports bounds covering the padded grid', () => {
    const { days, from, to } = monthGrid(2025, 3);
    expect(from).toBe(toYmd(days[0]));
    expect(to).toBe(toYmd(days[41]));
  });

  it('stays within the 62-day server cap', () => {
    const { days } = monthGrid(2025, 3);
    const span = (days[41].getTime() - days[0].getTime()) / 86_400_000;
    expect(span).toBeLessThanOrEqual(62);
  });
});

describe('labels', () => {
  it('formats the header subtitle and calendar stamp', () => {
    expect(formatDayHeading(d(2025, 4, 23))).toBe('Wed, 23 April');
    expect(formatDayStamp(d(2025, 4, 23))).toBe('WED, 23 APRIL');
  });

  it('formats the month header', () => {
    expect(formatMonthLabel(2025, 3)).toBe('April 2025');
  });

  // Short enough to sit beside an appointment number on one line without ellipsising.
  it('formats the compact search-row date', () => {
    expect(formatDayCompact(d(2025, 4, 18))).toBe('18 Apr');
    expect(formatDayCompact(d(2025, 10, 5))).toBe('5 Oct');
    expect(formatDayCompact(d(2025, 2, 28))).toBe('28 Feb');
  });
});
