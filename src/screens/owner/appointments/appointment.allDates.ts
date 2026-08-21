/**
 * All-dates mode: the pure decisions behind the Appointments screen's "no day selected" list.
 *
 * Tapping the already-selected day clears the selection, and the list then shows EVERY
 * appointment grouped by date, newest date first — the furthest future at the top, today's group
 * below it, the past running down to the oldest.
 *
 * None of that can be tested through the screen: jest here is `testEnvironment: 'node'` with no
 * renderer and no `@testing-library/react-native`, so a decision left inline in the JSX is a
 * decision nobody can cover. Same split as `appointment.view.ts` — RN-free on purpose, and it
 * imports only `utils/dateRange`, which has no imports of its own.
 */

import { addDays, daysBetweenYmd, formatDayStamp, parseYmd, toYmd } from '../../../utils/dateRange';

/** The least a row has to be for this module to place it. Real rows are `AppointmentRow`. */
export interface DatedRow {
  id: number;
  /** "YYYY-MM-DD", server-rendered in IST. */
  date: string;
  /** "HH:mm" 24h. Optional so fixtures and any future caller can omit it. */
  time?: string;
}

/** One date's worth of rows. `date` doubles as the SectionList section key. */
export interface DateSection<T> {
  date: string;
  data: T[];
}

// ─── The toggle ──────────────────────────────────────────────────────────────

/**
 * What the selection becomes when the user taps `tapped`.
 *
 * Tapping the day that is already selected clears it (→ all-dates); tapping any other day selects
 * it; tapping any day while nothing is selected selects it. `null` means "no day selected", which
 * is the only thing that puts the screen into all-dates mode — see `listModeFor`.
 */
export function toggleDaySelection(current: string | null, tapped: string): string | null {
  return current === tapped ? null : tapped;
}

// ─── The two fetch windows ───────────────────────────────────────────────────

/**
 * One bucket's slice of the appointments list endpoint. Structurally a subset of
 * `AppointmentListOptions`; deliberately NOT imported from the backend hook, because that module
 * reaches AsyncStorage through `session.storage` and would drag a native module into a plain-node
 * test run.
 */
export interface AppointmentDateWindow {
  fromDate?: string;
  toDate?: string;
  sortBy: 'appointmentDateTime';
  sortDir: 'asc' | 'desc';
}

export interface AllDatesWindows {
  /** Tomorrow onwards, ASCENDING — page 1 is the NEAREST future bookings. */
  future: AppointmentDateWindow;
  /** Today and everything before it, DESCENDING — page 1 is today and the most recent past. */
  todayAndPast: AppointmentDateWindow;
}

/**
 * The two independently-paged windows the all-dates list is built from.
 *
 * The list reads newest-date-first, so paging it forward as one descending query would start at
 * the furthest-future booking: a business with 200 future appointments would have today on page
 * ten, and "open scrolled to today" could not resolve without fetching all ten. Splitting at today
 * means each bucket only ever pages FORWARD through its own request, page 1 of each is adjacent to
 * today, and today is on screen in the first render.
 *
 * The two windows are cut from the SAME `today` string — `fromDate` = today + 1 against
 * `toDate` = today — so they are disjoint by construction and an appointment dated today can only
 * come back in the second bucket. (`buildDateSections` still de-duplicates, because a reschedule
 * between the two requests can move a row across the seam.)
 */
export function allDatesWindows(today: string): AllDatesWindows {
  const tomorrow = toYmd(addDays(parseYmd(today), 1));
  return {
    future: { fromDate: tomorrow, sortBy: 'appointmentDateTime', sortDir: 'asc' },
    todayAndPast: { toDate: today, sortBy: 'appointmentDateTime', sortDir: 'desc' },
  };
}

// ─── Grouping ────────────────────────────────────────────────────────────────

export interface BuildSectionsInput<T extends DatedRow> {
  /** Future bucket, as the API returned it (ascending, nearest-first). */
  future: readonly T[];
  /** Today-and-past bucket, as the API returned it (descending). */
  todayAndPast: readonly T[];
  /** "YYYY-MM-DD". The seam between the two buckets. */
  today: string;
}

/**
 * Both buckets → date sections, NEWEST DATE FIRST.
 *
 * Three rules that are each a real failure, not a preference:
 *
 *  1. **The seam is single-owner.** Every row dated on or before `today` belongs to the
 *     today-and-past bucket and every row after it to the future bucket, whichever bucket it
 *     actually arrived in. A reschedule landing between the two requests, or a device clock that
 *     disagrees with the server's IST day, otherwise delivers the same appointment twice — and
 *     SectionList's `keyExtractor` is the appointment id, so React would see duplicate keys and
 *     drop a row it had already mounted.
 *  2. **Ids are de-duplicated across the whole list**, today-and-past winning, for the same reason.
 *  3. **Order is recomputed, never inherited.** Sections are sorted by date descending and each
 *     section's rows by time ascending, so a date group reads exactly like the single-day view
 *     regardless of which bucket it came from, which direction that bucket was sorted, or what
 *     order its pages happened to arrive in.
 *
 * Rows with no date are dropped: `toAppointmentRow` defaults `date` to `''` when the server omits
 * `appointmentDate`, and an empty string sorts below every real date, so keeping them would hang a
 * blank-titled section off the bottom of the list.
 */
export function buildDateSections<T extends DatedRow>({
  future,
  todayAndPast,
  today,
}: BuildSectionsInput<T>): DateSection<T>[] {
  const seen = new Set<number>();
  const kept: T[] = [];

  const take = (row: T, belongsHere: boolean) => {
    if (!row.date || !belongsHere || seen.has(row.id)) return;
    seen.add(row.id);
    kept.push(row);
  };

  // Today-and-past first so it wins every id collision at the seam.
  for (const row of todayAndPast) take(row, row.date <= today);
  for (const row of future) take(row, row.date > today);

  const byDate = new Map<string, T[]>();
  for (const row of kept) {
    const bucket = byDate.get(row.date);
    if (bucket) bucket.push(row);
    else byDate.set(row.date, [row]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, data]) => ({
      date,
      // Zero-padded "HH:mm" sorts chronologically under a plain `<`. Deliberately not
      // `localeCompare`, whose collation of the ":" separator is locale-dependent. A row with no
      // time sorts first and, because Array#sort is stable, keeps the order the server sent it in.
      data: [...data].sort((x, y) => {
        const a = x.time ?? '';
        const b = y.time ?? '';
        return a < b ? -1 : a > b ? 1 : 0;
      }),
    }));
}

// ─── The opening scroll position ─────────────────────────────────────────────

/**
 * Which section the list should open on — today's, or the nearest sensible one.
 *
 * `sections` must be the output of {@link buildDateSections}, i.e. sorted by date descending.
 *
 *  - Today has appointments → today's own section.
 *  - Today has none → the nearest day AFTER today. Forwards, not backwards: someone who opens this
 *    on a quiet day is looking for what is coming, not what they already did. The list runs newest
 *    first, so that section sits one step ABOVE where today would have been.
 *  - Nothing after today either → walk backwards to the nearest day BEFORE today, so a shop with
 *    nothing booked ahead opens on its last day of business rather than on an empty screen.
 *  - No sections at all → -1, and the caller must not scroll. The screen shows its empty state in
 *    that case, so there is no list to scroll.
 *
 * An earlier version was one `findIndex` — the first section at or before today — which is today's
 * own group when it exists and the most recent PAST when it does not. That reads as the slot today
 * would have occupied, which is why it looked right, but it opens a blank Tuesday on last Friday's
 * finished work instead of on Thursday's booking.
 */
export function anchorSectionIndex(sections: readonly { date: string }[], today: string): number {
  if (sections.length === 0) return -1;
  // Sections are date-descending, so this is today's own group, or the first one older than it.
  const atOrBefore = sections.findIndex((section) => section.date <= today);
  // Nothing at or before today: every booking is in the future, and the LAST section is the
  // soonest of them. Index 0 would open on the furthest-away one.
  if (atOrBefore === -1) return sections.length - 1;
  if (sections[atOrBefore].date === today) return atOrBefore;
  // Today is blank. One step up the descending list is the nearest future day; if there is no step
  // up, there is no future at all and this index is already the nearest past.
  return atOrBefore > 0 ? atOrBefore - 1 : atOrBefore;
}

/**
 * The absolute cell index VirtualizedSectionList gives section `index`'s HEADER.
 *
 * Mirrors `VirtualizedSectionList.scrollToLocation`, which computes
 * `itemIndex + Σ(previous section item counts + 2)` — the `+ 2` is that section's own header and
 * footer cells. Duplicated here rather than guessed because the screen needs the number BEFORE it
 * can scroll: it sizes `initialNumToRender` so the first commit already reaches the anchor's own
 * header cell, which is what keeps the list from painting a blank band above today while the
 * windowing catches up.
 *
 * It is no longer what makes the scroll POSSIBLE — see {@link allDatesCellLayout} for that.
 */
export function sectionHeaderCellIndex(
  sections: readonly { data: readonly unknown[] }[],
  index: number,
): number {
  let cells = 0;
  for (let i = 0; i < Math.min(index, sections.length); i++) cells += sections[i].data.length + 2;
  return cells;
}

// ─── Cell geometry ───────────────────────────────────────────────────────────

/**
 * Every length the all-dates list's cell offsets are built from, in px.
 *
 * Not one of the four is a pixel count written down here. Two are read off the first card and the
 * first date band the screen actually lays out, `contentStart` adds the measured header inset to a
 * height the stylesheet pins outright, and the footer is zero because nothing renders in it.
 *
 * The two measured ones are measured rather than guessed because a row's height is the tallest of
 * its children, and every one of those is a `<Text>` whose line height comes from the platform's
 * own font metrics and is then multiplied by the user's system text-size setting. There is no
 * number that is true on both an iPhone and an Android phone, still less at 200% text size — and a
 * `getItemLayout` that is wrong by two pixels a row puts the opening scroll a whole card out after
 * twenty of them.
 *
 * What lives here is only the arithmetic, which is the half that can be tested.
 */
export interface AllDatesCellMetrics {
  /**
   * One appointment card's cell: the card's own box PLUS the gap below it. VirtualizedList wraps
   * each rendered item in a plain `<View>`, and a Yoga container's auto height is the sum of its
   * children's MARGIN boxes — so the card's `marginBottom` is inside the cell, not between cells.
   */
  row: number;
  /** One date band's cell. */
  sectionHeader: number;
  /**
   * The footer cell VirtualizedSectionList gives every section whether or not anything renders in
   * it. With no `renderSectionFooter` the cell's View has no children and measures 0 — but it
   * still occupies an INDEX, which is the `+ 2` in {@link sectionHeaderCellIndex}, so it has to be
   * counted even when it is zero tall.
   */
  sectionFooter: number;
  /**
   * Everything between the top of the scroll content and cell 0: the list's `contentContainerStyle`
   * paddingTop, plus the `ListHeaderComponent`.
   *
   * Load-bearing, and the easiest thing to leave out. VirtualizedList does not add the header or
   * the content padding to whatever `getItemLayout` returns — it feeds the value straight to
   * `scrollTo`, whose origin is the top of the content container, padding included. An offset
   * measured from the first cell instead would land the anchor short by exactly this much, which
   * on this screen is a collapsed header plus the top cap: hundreds of pixels, i.e. two whole date
   * groups above the day the list was asked to open on.
   */
  contentStart: number;
}

/** The shape `getItemLayout` has to return. Named so the screen does not restate it. */
export interface CellLayout {
  length: number;
  offset: number;
  index: number;
}

/**
 * Where cell `index` sits, for `getItemLayout`.
 *
 * VirtualizedSectionList flattens the sections into one cell list as
 * `[section header, ...rows, section footer]` per section — the same layout `scrollToLocation`
 * walks and the same one {@link sectionHeaderCellIndex} counts.
 *
 * This exists because `scrollToIndex` REFUSES any index past the highest frame it has measured
 * unless a `getItemLayout` is supplied, and the all-dates list opens part-way down: today's group
 * sits below every future date, so on the first commit it is outside every measured frame and the
 * opening scroll fails into `onScrollToIndexFailed`. Retrying does not help, because with nothing
 * to compute an offset from the retry is refused for the same reason. Handing the list computable
 * offsets is what removes the refusal — `scrollToIndex` skips the measurement check entirely when
 * `getItemLayout` is present.
 *
 * An index outside the list answers `length: 0` at the very end of the content rather than
 * throwing. VirtualizedList already guards the range itself, so this is only about not turning a
 * caller's off-by-one into a crash; an offset past the end is a scroll that stops at the bottom,
 * which is the honest answer to "show me a cell that is not there".
 */
export function allDatesCellLayout(
  sections: readonly { data: readonly unknown[] }[],
  index: number,
  metrics: AllDatesCellMetrics,
): CellLayout {
  const { row, sectionHeader, sectionFooter, contentStart } = metrics;
  let offset = contentStart;
  if (index < 0) return { length: 0, offset, index };

  let cell = 0;
  for (const section of sections) {
    const count = section.data.length;
    if (index === cell) return { length: sectionHeader, offset, index };
    const firstRow = cell + 1;
    if (index < firstRow + count) {
      return { length: row, offset: offset + sectionHeader + (index - firstRow) * row, index };
    }
    if (index === firstRow + count) {
      return { length: sectionFooter, offset: offset + sectionHeader + count * row, index };
    }
    cell += count + 2;
    offset += sectionHeader + count * row + sectionFooter;
  }
  return { length: 0, offset, index };
}

// ─── Section headings ────────────────────────────────────────────────────────

/**
 * A date group's heading, e.g. "TODAY · WED, 23 APRIL".
 *
 * The relative word carries the whole point of the ordering: with the future above and the past
 * below, "TODAY" is the only landmark telling the user which way they have scrolled. Yesterday and
 * tomorrow get one too because they are the two dates a bare stamp is easiest to misread as today.
 */
export function sectionHeading(date: string, today: string): string {
  const stamp = formatDayStamp(parseYmd(date));
  const delta = daysBetweenYmd(today, date);
  if (delta === 0) return `TODAY · ${stamp}`;
  if (delta === 1) return `TOMORROW · ${stamp}`;
  if (delta === -1) return `YESTERDAY · ${stamp}`;
  return stamp;
}
