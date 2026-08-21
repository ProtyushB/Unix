import {
  allDatesCellLayout,
  allDatesWindows,
  anchorSectionIndex,
  buildDateSections,
  sectionHeaderCellIndex,
  sectionHeading,
  toggleDaySelection,
  type DatedRow,
} from './appointment.allDates';

const TODAY = '2025-04-23';

/** Minimal row: an id, the IST day it sits on, and its wall-clock time. */
const row = (id: number, date: string, time = '10:00'): DatedRow => ({ id, date, time });

/** Flattens sections to `date/id` pairs so an assertion reads as the rendered order. */
const shape = (sections: { date: string; data: DatedRow[] }[]) =>
  sections.map((s) => [s.date, s.data.map((r) => r.id)] as const);

describe('toggleDaySelection', () => {
  it('selects a day that was not selected', () => {
    expect(toggleDaySelection('2025-04-23', '2025-04-25')).toBe('2025-04-25');
  });

  // The whole feature: a second tap on the highlighted day clears it.
  it('clears the selection when the selected day is tapped again', () => {
    expect(toggleDaySelection('2025-04-23', '2025-04-23')).toBeNull();
  });

  it('selects a day again from the cleared state', () => {
    expect(toggleDaySelection(null, '2025-04-23')).toBe('2025-04-23');
  });

  // Guards the obvious mis-implementation — a plain "flip a boolean" toggle would deselect here
  // too, so tapping across the week strip would blank the list every other tap.
  it('does not clear when a different day is tapped', () => {
    expect(toggleDaySelection('2025-04-23', '2025-04-24')).toBe('2025-04-24');
  });
});

describe('allDatesWindows', () => {
  it('starts the future at tomorrow, ascending', () => {
    expect(allDatesWindows(TODAY).future).toEqual({
      fromDate: '2025-04-24',
      sortBy: 'appointmentDateTime',
      sortDir: 'asc',
    });
  });

  it('ends the today-and-past bucket at today, descending', () => {
    expect(allDatesWindows(TODAY).todayAndPast).toEqual({
      toDate: TODAY,
      sortBy: 'appointmentDateTime',
      sortDir: 'desc',
    });
  });

  // The seam. `fromDate` of the future bucket must be strictly after `toDate` of the other, or an
  // appointment dated today comes back in both and the list renders it twice.
  it('cuts two windows that cannot overlap', () => {
    const { future, todayAndPast } = allDatesWindows(TODAY);
    expect(future.fromDate! > todayAndPast.toDate!).toBe(true);
  });

  it('rolls the seam over a month end', () => {
    expect(allDatesWindows('2025-04-30').future.fromDate).toBe('2025-05-01');
    expect(allDatesWindows('2025-12-31').future.fromDate).toBe('2026-01-01');
  });

  // Ascending, because page 1 of the future has to be the NEAREST bookings: descending would make
  // page 1 the furthest-away ones and put today ten pages down on a busy business.
  it('pages the future from the nearest date, not the furthest', () => {
    expect(allDatesWindows(TODAY).future.sortDir).toBe('asc');
  });
});

describe('buildDateSections', () => {
  it('runs the furthest future first, today in the middle, the oldest past last', () => {
    const sections = buildDateSections({
      future: [row(1, '2025-04-24'), row(2, '2025-04-27')],
      todayAndPast: [row(3, TODAY), row(4, '2025-04-20'), row(5, '2025-04-01')],
      today: TODAY,
    });

    expect(sections.map((s) => s.date)).toEqual([
      '2025-04-27',
      '2025-04-24',
      '2025-04-23',
      '2025-04-20',
      '2025-04-01',
    ]);
  });

  // The future bucket arrives ascending (nearest first) so its page 1 is the useful one. Rendering
  // it in arrival order would put the nearest date at the top and read backwards.
  it('reverses the future bucket rather than rendering it in arrival order', () => {
    const sections = buildDateSections({
      future: [row(1, '2025-04-24'), row(2, '2025-04-25'), row(3, '2025-04-26')],
      todayAndPast: [],
      today: TODAY,
    });
    expect(sections.map((s) => s.date)).toEqual(['2025-04-26', '2025-04-25', '2025-04-24']);
  });

  // Sections descend, but a single date still reads top-down like the single-day view does.
  it('orders each date chronologically, whichever bucket it came from', () => {
    const sections = buildDateSections({
      // Both buckets handed over in their own server order: future ascending, past descending.
      future: [row(1, '2025-04-25', '09:00'), row(2, '2025-04-25', '17:30')],
      todayAndPast: [row(3, TODAY, '18:00'), row(4, TODAY, '08:15'), row(5, TODAY, '12:00')],
      today: TODAY,
    });
    expect(shape(sections)).toEqual([
      ['2025-04-25', [1, 2]],
      [TODAY, [4, 5, 3]],
    ]);
  });

  // A reschedule landing between the two requests can hand the same appointment back in both.
  // keyExtractor is the id, so a duplicate is a duplicate React key and a dropped row.
  it('keeps a today-dated appointment out of the future bucket', () => {
    const sections = buildDateSections({
      future: [row(7, TODAY, '11:00'), row(8, '2025-04-24')],
      todayAndPast: [row(7, TODAY, '11:00')],
      today: TODAY,
    });
    expect(shape(sections)).toEqual([
      ['2025-04-24', [8]],
      [TODAY, [7]],
    ]);
  });

  // The other half of that race: the reschedule has already been applied, so the two requests
  // disagree about which date the row is on. Whichever bucket is read first decides, and it has to
  // be the today-and-past one — the list opens on today, so a row shown only in the future group
  // is a row the user cannot see disappearing from where they are looking.
  it('lets the today-and-past bucket win when the two buckets disagree on the date', () => {
    const sections = buildDateSections({
      future: [row(7, '2025-04-24', '11:00')],
      todayAndPast: [row(7, TODAY, '11:00')],
      today: TODAY,
    });
    expect(shape(sections)).toEqual([[TODAY, [7]]]);
  });

  it('de-duplicates a repeated id anywhere in either bucket', () => {
    const sections = buildDateSections({
      future: [row(1, '2025-04-24'), row(1, '2025-04-24')],
      todayAndPast: [row(2, '2025-04-20'), row(2, '2025-04-20')],
      today: TODAY,
    });
    expect(shape(sections)).toEqual([
      ['2025-04-24', [1]],
      ['2025-04-20', [2]],
    ]);
  });

  // A future page that somehow carries a past row still lands in the right group.
  it('places every row by its own date, not by the bucket it arrived in', () => {
    const sections = buildDateSections({
      future: [row(1, '2025-04-10')],
      todayAndPast: [row(2, '2025-05-01')],
      today: TODAY,
    });
    // The future row is before today, so the future bucket does not own it; the past bucket does
    // not own a future row either. Neither survives — each is out of its window.
    expect(sections).toEqual([]);
  });

  // `toAppointmentRow` defaults `date` to '' when the server omits appointmentDate, and '' sorts
  // below every real date — a kept row would hang a blank-titled section off the bottom.
  it('drops a row with no date', () => {
    const sections = buildDateSections({
      future: [],
      todayAndPast: [row(1, ''), row(2, TODAY)],
      today: TODAY,
    });
    expect(shape(sections)).toEqual([[TODAY, [2]]]);
  });

  it('handles a business with no future at all', () => {
    const sections = buildDateSections({
      future: [],
      todayAndPast: [row(1, TODAY), row(2, '2025-04-22')],
      today: TODAY,
    });
    expect(sections.map((s) => s.date)).toEqual([TODAY, '2025-04-22']);
  });

  it('handles a business whose only appointments are in the past', () => {
    const sections = buildDateSections({
      future: [],
      todayAndPast: [row(1, '2025-04-22'), row(2, '2024-11-03')],
      today: TODAY,
    });
    expect(sections.map((s) => s.date)).toEqual(['2025-04-22', '2024-11-03']);
  });

  it('handles nothing anywhere', () => {
    expect(buildDateSections({ future: [], todayAndPast: [], today: TODAY })).toEqual([]);
  });
});

describe('anchorSectionIndex', () => {
  const sections = (...dates: string[]) => dates.map((date) => ({ date }));

  it('lands on today when today has appointments', () => {
    expect(anchorSectionIndex(sections('2025-04-27', TODAY, '2025-04-20'), TODAY)).toBe(1);
  });

  // Today with nothing booked is the ordinary case, not an edge one. It resolves FORWARDS: someone
  // opening this on a quiet day wants what is coming, not what they already finished. The list is
  // newest-first, so the nearest future day is one step ABOVE the slot today would have held.
  it('lands on the nearest day after today when today is empty', () => {
    // 27th and 22nd straddle the 23rd. The 27th is the answer; the 22nd is last week's work.
    expect(anchorSectionIndex(sections('2025-04-27', '2025-04-22', '2025-04-01'), TODAY)).toBe(0);
  });

  it('prefers the SOONEST future day, not the furthest, when today is empty', () => {
    // Three future groups: the 24th is the one to open on, even though the 30th is uppermost.
    expect(
      anchorSectionIndex(sections('2025-04-30', '2025-04-26', '2025-04-24', '2025-04-20'), TODAY),
    ).toBe(2);
  });

  // A brand-new business: everything is booked ahead. Index 0 would open on the FURTHEST booking,
  // which is the one screen the user is least likely to want.
  it('lands on the nearest future group when there is no past at all', () => {
    expect(anchorSectionIndex(sections('2025-06-01', '2025-05-02', '2025-04-24'), TODAY)).toBe(2);
  });

  // The walk-backwards fallback, and the reason it exists: a shop with nothing booked ahead would
  // otherwise open on nothing. It lands on their last day of business instead.
  it('walks backwards to the newest past group when there is no future at all', () => {
    expect(anchorSectionIndex(sections('2025-04-22', '2025-03-02'), TODAY)).toBe(0);
  });

  // Guards the ordering of the two rules: today present wins even when a future day also exists,
  // so a busy today is never skipped in favour of tomorrow.
  it('prefers today over the day after it', () => {
    expect(anchorSectionIndex(sections('2025-04-24', TODAY, '2025-04-22'), TODAY)).toBe(1);
  });

  // -1 rather than 0: there is no section to scroll to, and scrollToLocation(0) on an empty list
  // is an out-of-range index rather than a no-op.
  it('reports no anchor for an empty list', () => {
    expect(anchorSectionIndex([], TODAY)).toBe(-1);
  });
});

describe('sectionHeaderCellIndex', () => {
  // Mirrors VirtualizedSectionList.scrollToLocation: itemIndex + Σ(count + 2), the +2 being each
  // preceding section's own header and footer cells.
  it('counts a header and a footer cell for every preceding section', () => {
    const sections = [{ data: [1, 2] }, { data: [3] }, { data: [4, 5, 6] }];
    expect(sectionHeaderCellIndex(sections, 0)).toBe(0);
    expect(sectionHeaderCellIndex(sections, 1)).toBe(4);
    expect(sectionHeaderCellIndex(sections, 2)).toBe(7);
  });

  // A section with no rows still costs its two cells; dropping them would under-count the window
  // that initialNumToRender has to cover and the opening scroll would fall short.
  it('still counts an empty section', () => {
    expect(sectionHeaderCellIndex([{ data: [] }], 1)).toBe(2);
  });

  it('does not run past the end for an out-of-range index', () => {
    expect(sectionHeaderCellIndex([{ data: [1] }], 9)).toBe(3);
  });
});

describe('allDatesCellLayout', () => {
  /**
   * Deliberately unlike each other. A row 80 tall, a header half that and a content start that is
   * neither means a dropped term shows up as a wrong number rather than as a coincidence.
   */
  const M = { row: 80, sectionHeader: 40, sectionFooter: 0, contentStart: 215 };
  /** The same list with a footer that is actually visible, for the tests about the `+ 2`. */
  const WITH_FOOTER = { ...M, sectionFooter: 6 };

  // 2 rows, then 1, then 3 → cells 0-3, 4-6, 7-11. Twelve in total.
  const three = [{ data: [1, 2] }, { data: [3] }, { data: [4, 5, 6] }];

  // The offset every other test is measured from. Starting at 0 would put the anchor a collapsed
  // header and a top cap too high — the list would open two date groups past the one it was asked
  // for, which is the bug this whole function exists to make impossible.
  it('starts the first cell at the content start, not at zero', () => {
    expect(allDatesCellLayout(three, 0, M)).toEqual({ length: 40, offset: 215, index: 0 });
  });

  it('gives a section header the header height', () => {
    // Section 1's header: 215 + (40 + 2×80) of section 0 above it.
    expect(allDatesCellLayout(three, 4, M)).toEqual({ length: 40, offset: 415, index: 4 });
  });

  it('steps through a section one row height at a time', () => {
    expect(allDatesCellLayout(three, 1, M)).toEqual({ length: 80, offset: 255, index: 1 });
    expect(allDatesCellLayout(three, 2, M)).toEqual({ length: 80, offset: 335, index: 2 });
    // Third section, its three rows: 535 is its header, so the rows follow at +40 then +80 each.
    expect(allDatesCellLayout(three, 8, M)).toEqual({ length: 80, offset: 575, index: 8 });
    expect(allDatesCellLayout(three, 9, M)).toEqual({ length: 80, offset: 655, index: 9 });
    expect(allDatesCellLayout(three, 10, M)).toEqual({ length: 80, offset: 735, index: 10 });
  });

  it('places the footer cell after the last row of its section', () => {
    expect(allDatesCellLayout(three, 3, WITH_FOOTER)).toEqual({
      length: 6,
      offset: 415,
      index: 3,
    });
  });

  // The `+ 2` in the flattening. A footer skipped in the height sum shifts every section below it
  // up by one footer, and the anchor lands that much too far down the list.
  it('carries each section footer into the sections below it', () => {
    // Section 1's header is one footer lower than it was without them.
    expect(allDatesCellLayout(three, 4, WITH_FOOTER).offset).toBe(421);
    // Section 2's header: two footers lower.
    expect(allDatesCellLayout(three, 7, WITH_FOOTER).offset).toBe(547);
  });

  it('answers the last cell in the list', () => {
    expect(allDatesCellLayout(three, 11, WITH_FOOTER)).toEqual({
      length: 6,
      offset: 827,
      index: 11,
    });
  });

  // VirtualizedList range-checks before it asks, so this is only about not turning a caller's
  // off-by-one into a thrown frame. The end of the content is the honest answer.
  it('answers the end of the content for an index past the last cell', () => {
    expect(allDatesCellLayout(three, 12, WITH_FOOTER)).toEqual({
      length: 0,
      offset: 833,
      index: 12,
    });
    expect(allDatesCellLayout(three, 99, WITH_FOOTER).offset).toBe(833);
  });

  it('answers the content start for a negative index', () => {
    expect(allDatesCellLayout(three, -1, M)).toEqual({ length: 0, offset: 215, index: -1 });
  });

  // The list is mounted before either bucket answers on some paths, so this is a real call and not
  // a defensive one.
  it('handles a list with no sections at all', () => {
    expect(allDatesCellLayout([], 0, M)).toEqual({ length: 0, offset: 215, index: 0 });
  });

  // A section with no rows still costs two cells and one header's worth of height. Dropping either
  // desynchronises every index below it from the one scrollToLocation computes.
  it('still counts an empty section', () => {
    const withEmpty = [{ data: [] }, { data: [1] }];
    expect(allDatesCellLayout(withEmpty, 0, M)).toEqual({ length: 40, offset: 215, index: 0 });
    expect(allDatesCellLayout(withEmpty, 1, M)).toEqual({ length: 0, offset: 255, index: 1 });
    expect(allDatesCellLayout(withEmpty, 2, M)).toEqual({ length: 40, offset: 255, index: 2 });
    expect(allDatesCellLayout(withEmpty, 3, M)).toEqual({ length: 80, offset: 295, index: 3 });
    expect(allDatesCellLayout(withEmpty, 4, M)).toEqual({ length: 0, offset: 375, index: 4 });
  });

  // The two halves of the anchor: `sectionHeaderCellIndex` decides WHICH cell to scroll to and
  // this decides WHERE it is. If they ever disagree about the flattening the scroll lands on some
  // other section, so tie them together rather than trusting two hand-written `+ 2`s to match.
  it('agrees with sectionHeaderCellIndex about where each header cell is', () => {
    three.forEach((_, i) => {
      const cell = sectionHeaderCellIndex(three, i);
      expect(allDatesCellLayout(three, cell, WITH_FOOTER).length).toBe(WITH_FOOTER.sectionHeader);
    });
  });

  /**
   * The one case whose numbers were not invented.
   *
   * Read out of the DOM of the real all-dates list in the web preview (iPhone 16 preset,
   * 2026-08-21, six future appointments over five dates): the top cap laid out at 46, every row
   * cell at 84 — a 74px card plus the 10px gap under it, identical across six rows with different
   * names, times, amounts and statuses — every date band at 39 including the longest heading on
   * screen, and each section's footer cell at 0. Today's band sat at offsetTop 745.
   *
   * `contentStart` is 46 rather than 46 plus a header because that harness never delivers a layout
   * event, so the collapsing header measured 0 and the list reserved no padding for it. That is a
   * property of the harness, not of the arithmetic — which is exactly why the section walk below
   * is the part worth pinning to a real screen.
   */
  it('reproduces a layout measured off the real screen', () => {
    const real = { row: 84, sectionHeader: 39, sectionFooter: 0, contentStart: 46 };
    const dates = [{ data: [1] }, { data: [1] }, { data: [1] }, { data: [1, 2] }, { data: [1] }];
    const withToday = [...dates, { data: [1, 2, 3] }];

    const todayHeaderCell = sectionHeaderCellIndex(withToday, 5);
    expect(todayHeaderCell).toBe(16);
    expect(allDatesCellLayout(withToday, todayHeaderCell, real)).toEqual({
      length: 39,
      offset: 745,
      index: 16,
    });
  });

  // Twenty rows is one page of one bucket. A per-row error of a pixel is invisible at row two and
  // a whole card out by row twenty, which is the failure mode of guessing the row height.
  it('does not drift down a long section', () => {
    const long = [{ data: Array.from({ length: 20 }, (_, i) => i) }];
    expect(allDatesCellLayout(long, 20, M)).toEqual({ length: 80, offset: 1775, index: 20 });
  });
});

describe('sectionHeading', () => {
  it('names today, so the user can tell which way they have scrolled', () => {
    expect(sectionHeading(TODAY, TODAY)).toBe('TODAY · WED, 23 APRIL');
  });

  it('names the two dates a bare stamp is easiest to misread as today', () => {
    expect(sectionHeading('2025-04-24', TODAY)).toBe('TOMORROW · THU, 24 APRIL');
    expect(sectionHeading('2025-04-22', TODAY)).toBe('YESTERDAY · TUE, 22 APRIL');
  });

  it('leaves every other date as a plain stamp', () => {
    expect(sectionHeading('2025-04-27', TODAY)).toBe('SUN, 27 APRIL');
    expect(sectionHeading('2025-04-01', TODAY)).toBe('TUE, 1 APRIL');
  });

  // Crossing a month boundary is where a naive "same day number" check would call 1 May "today".
  it('does not confuse a neighbouring month for a neighbouring day', () => {
    expect(sectionHeading('2025-05-23', TODAY)).toBe('FRI, 23 MAY');
  });
});
