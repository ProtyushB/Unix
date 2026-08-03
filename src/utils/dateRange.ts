// ─── Date-range presets (Orders V2 date chips) ───────────────────────────────
// Presets resolve to a { fromDate, toDate } pair of local YYYY-MM-DD strings that
// the backend interprets in IST (toDate inclusive → half-open [from, nextMidnight)
// on orderDate). Users are in IST, so the device-local calendar day IS the IST day.
// `ALL` returns an empty range (no date filter).

export type DatePresetId = 'ALL' | 'YESTERDAY' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'THIS_MONTH';

export interface DatePreset {
  id: DatePresetId;
  label: string;
}

export const DATE_PRESETS: DatePreset[] = [
  { id: 'ALL', label: 'All' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'THIS_MONTH', label: 'This Month' },
];

export interface DateRange {
  fromDate?: string;
  toDate?: string;
}

/** Local YYYY-MM-DD (no UTC shift — the device day is the user's IST day). */
export function toYmd(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`;
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local-midnight date `n` days from `base`. Month/year rollover is handled by the Date ctor. */
export function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

/**
 * Inverse of {@link toYmd}: "2025-04-23" → local midnight on that day.
 *
 * Deliberately built from parts rather than `new Date(ymd)`, which parses a bare date string as
 * UTC and therefore lands on the previous day for anyone east of Greenwich — including every IST
 * user, all day.
 */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the ISO week containing `d`. getDay() is 0=Sun..6=Sat, so shift Sunday to the end. */
export function startOfIsoWeek(d: Date): Date {
  return addDays(atMidnight(d), -((d.getDay() + 6) % 7));
}

/** The seven days Mon..Sun of the ISO week containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const monday = startOfIsoWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * A 6x7 Monday-start month grid, plus the YMD bounds of the padded grid.
 *
 * The bounds cover the leading/trailing days from the neighbouring months, not just the calendar
 * month — those squares are rendered and tappable, so fetching only the month would leave them
 * dot-less and looking empty when they are not.
 *
 * Always 42 cells so the grid never changes height as you page between months.
 */
export function monthGrid(year: number, month: number): { days: Date[]; from: string; to: string } {
  const first = new Date(year, month, 1);
  const start = startOfIsoWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return { days, from: toYmd(days[0]), to: toYmd(days[41]) };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Wed, 23 April" — the Appointments header subtitle. */
export function formatDayHeading(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "WED, 23 APRIL" — the calendar view's section stamp above the day list. */
export function formatDayStamp(d: Date): string {
  return formatDayHeading(d).toUpperCase();
}

/**
 * "18 Jul" — the compact form used on search result rows.
 *
 * Search spans all dates, so each row has to say which day it is on, but the row's meta line also
 * carries the appointment number. The full "Sat, 18 July" pushed that line past its width and got
 * ellipsised at exactly the informative part ("Sat, 18 …"), which defeated the point of showing a
 * date at all. Dropping the weekday and abbreviating the month fits.
 */
export function formatDayCompact(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "April 2025" — the month-grid header. */
export function formatMonthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Resolve a preset to a concrete date range. `now` is injectable for testing. */
export function rangeForPreset(id: DatePresetId, now: Date = new Date()): DateRange {
  const today = atMidnight(now);
  switch (id) {
    case 'ALL':
      return {};
    case 'TODAY':
      return { fromDate: toYmd(today), toDate: toYmd(today) };
    case 'YESTERDAY': {
      const y = addDays(today, -1);
      return { fromDate: toYmd(y), toDate: toYmd(y) };
    }
    case 'TOMORROW': {
      const t = addDays(today, 1);
      return { fromDate: toYmd(t), toDate: toYmd(t) };
    }
    case 'THIS_WEEK': {
      // ISO week: Monday-start. getDay() is 0=Sun..6=Sat → shift so Mon=0.
      const mondayOffset = (today.getDay() + 6) % 7;
      const start = addDays(today, -mondayOffset);
      return { fromDate: toYmd(start), toDate: toYmd(addDays(start, 6)) };
    }
    case 'THIS_MONTH': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of month
      return { fromDate: toYmd(start), toDate: toYmd(end) };
    }
    default:
      return {};
  }
}
