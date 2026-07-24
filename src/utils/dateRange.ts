// ─── Date-range presets (Orders V2 date chips) ───────────────────────────────
// Presets resolve to a { fromDate, toDate } pair of local YYYY-MM-DD strings that
// the backend interprets in IST (toDate inclusive → half-open [from, nextMidnight)
// on orderDate). Users are in IST, so the device-local calendar day IS the IST day.
// `ALL` returns an empty range (no date filter).

export type DatePresetId =
  | 'ALL'
  | 'YESTERDAY'
  | 'TODAY'
  | 'TOMORROW'
  | 'THIS_WEEK'
  | 'THIS_MONTH';

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

function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
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
