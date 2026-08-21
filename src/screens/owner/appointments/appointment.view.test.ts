import {
  deriveView,
  showsFab,
  showsDateNav,
  dayDotCount,
  headerCollapses,
  listKeyFor,
  listModeFor,
  type ViewInput,
} from './appointment.view';

/** Browsing the day surface with 23 April selected, one request completed, one row. */
const base: ViewInput = {
  surface: 'DAY',
  mode: 'browse',
  selectedDate: '2025-04-23',
  query: '',
  rowCount: 1,
  loadedOnce: true,
  hasError: false,
};

const v = (over: Partial<ViewInput>) => deriveView({ ...base, ...over });

describe('deriveView — browse', () => {
  it('shows the day list when rows are present', () => {
    expect(v({})).toBe('DAY');
  });

  it('shows the day empty state when the day has nothing', () => {
    expect(v({ rowCount: 0 })).toBe('DAY_EMPTY');
  });

  it('shows the calendar list and its empty state', () => {
    expect(v({ surface: 'CALENDAR' })).toBe('CALENDAR');
    expect(v({ surface: 'CALENDAR', rowCount: 0 })).toBe('CALENDAR_EMPTY');
  });

  // The flashing-EMPTY bug from Orders: before the first request resolves there are no rows, and a
  // naive check reports "loaded and empty" for a frame.
  it('shows loading before the first request completes, not the empty state', () => {
    expect(v({ loadedOnce: false, rowCount: 0 })).toBe('LOADING');
    expect(v({ surface: 'CALENDAR', loadedOnce: false, rowCount: 0 })).toBe('CALENDAR_LOADING');
  });
});

describe('deriveView — search', () => {
  const searching = { mode: 'search' as const };

  it('stays idle while the box is focused but empty', () => {
    expect(v({ ...searching, query: '', rowCount: 0, loadedOnce: true })).toBe('SEARCH_IDLE');
  });

  // Even with rows still on screen from the previous browse, an empty query must not render a
  // result count — that was the "20 results for ''" bug on Orders.
  it('stays idle even when stale rows are still held', () => {
    expect(v({ ...searching, query: '', rowCount: 7 })).toBe('SEARCH_IDLE');
  });

  it('shows a skeleton while the query is in flight', () => {
    expect(v({ ...searching, query: 'sharma', loadedOnce: false, rowCount: 0 })).toBe('SEARCHING');
  });

  it('shows results and no-results', () => {
    expect(v({ ...searching, query: 'sharma', rowCount: 3 })).toBe('SEARCH_RESULTS');
    expect(v({ ...searching, query: 'vikram', rowCount: 0 })).toBe('NO_RESULTS');
  });

  it('search wins over the surface — a calendar toggle does not leak into search', () => {
    expect(v({ ...searching, surface: 'CALENDAR', query: 'x', rowCount: 2 })).toBe(
      'SEARCH_RESULTS',
    );
  });
});

describe('listModeFor', () => {
  it('is the day list while a day is selected', () => {
    expect(listModeFor({ mode: 'browse', selectedDate: '2025-04-23' })).toBe('day');
  });

  it('is the all-dates list once the selection is cleared', () => {
    expect(listModeFor({ mode: 'browse', selectedDate: null })).toBe('all');
  });

  // Search is global across every date. Were the selection allowed to win, a query typed with a
  // day selected would silently be a one-day search, and a query typed with none would fetch the
  // all-dates buckets and ignore the query outright.
  it('is search whatever the selection is', () => {
    expect(listModeFor({ mode: 'search', selectedDate: '2025-04-23' })).toBe('search');
    expect(listModeFor({ mode: 'search', selectedDate: null })).toBe('search');
  });
});

describe('listKeyFor', () => {
  const today = '2025-04-23';

  it('keys each mode into its own namespace', () => {
    expect(listKeyFor({ mode: 'browse', selectedDate: '2025-04-23', query: '', today })).toBe(
      'd:2025-04-23',
    );
    expect(listKeyFor({ mode: 'browse', selectedDate: null, query: '', today })).toBe(
      'a:2025-04-23',
    );
    expect(listKeyFor({ mode: 'search', selectedDate: null, query: '98', today })).toBe('s:98');
  });

  // The whole point of the key: the refetch effect fires on a change of string. Deselecting today
  // is a mode change that leaves both the date and the query untouched, so an unprefixed key would
  // be byte-identical before and after and the all-dates buckets would never be fetched.
  it('changes when today is deselected, even though the date has not moved', () => {
    const selected = listKeyFor({ mode: 'browse', selectedDate: today, query: '', today });
    const cleared = listKeyFor({ mode: 'browse', selectedDate: null, query: '', today });
    expect(cleared).not.toBe(selected);
  });

  // Two buckets cut at `today`. Past midnight that seam has moved, so the key has to as well or
  // the list keeps paging a "future" window that now starts the day after tomorrow.
  it('re-keys the all-dates list when the day rolls over', () => {
    expect(listKeyFor({ mode: 'browse', selectedDate: null, query: '', today })).not.toBe(
      listKeyFor({ mode: 'browse', selectedDate: null, query: '', today: '2025-04-24' }),
    );
  });
});

describe('deriveView — all dates', () => {
  const cleared = { selectedDate: null };

  it('shows the all-dates list when rows are present', () => {
    expect(v({ ...cleared })).toBe('ALL');
  });

  it('shows its own empty state when the business has nothing anywhere', () => {
    expect(v({ ...cleared, rowCount: 0 })).toBe('ALL_EMPTY');
  });

  // Both buckets are fetched together and land together, so the skeleton has to cover the gap or
  // the screen reports "no appointments at all" for a frame.
  it('shows loading before the buckets land, not the empty state', () => {
    expect(v({ ...cleared, loadedOnce: false, rowCount: 0 })).toBe('ALL_LOADING');
  });

  // The calendar is navigation, not a second list. With no day selected it has no day to show, so
  // the body stays on the all-dates list rather than rendering the calendar's single-day states.
  it('outranks the calendar surface', () => {
    expect(v({ ...cleared, surface: 'CALENDAR' })).toBe('ALL');
    expect(v({ ...cleared, surface: 'CALENDAR', rowCount: 0 })).toBe('ALL_EMPTY');
  });

  it('yields to search', () => {
    expect(v({ ...cleared, mode: 'search', query: 'sharma', rowCount: 3 })).toBe('SEARCH_RESULTS');
  });
});

describe('deriveView — error precedence', () => {
  it('takes over only when there is nothing to show', () => {
    expect(v({ hasError: true, rowCount: 0 })).toBe('ERROR');
  });

  // A failed page-2 fetch must not blank a populated list.
  it('leaves a populated list alone', () => {
    expect(v({ hasError: true, rowCount: 5 })).toBe('DAY');
  });

  it('does not fire before the first request has completed', () => {
    expect(v({ hasError: true, rowCount: 0, loadedOnce: false })).toBe('LOADING');
  });
});

describe('chrome visibility', () => {
  it('hides the FAB in every search state and in error', () => {
    expect(showsFab('DAY')).toBe(true);
    expect(showsFab('DAY_EMPTY')).toBe(true);
    expect(showsFab('CALENDAR')).toBe(true);
    expect(showsFab('LOADING')).toBe(true);
    expect(showsFab('ALL')).toBe(true);
    expect(showsFab('ALL_EMPTY')).toBe(true);
    expect(showsFab('ALL_LOADING')).toBe(true);
    expect(showsFab('SEARCH_RESULTS')).toBe(false);
    expect(showsFab('NO_RESULTS')).toBe(false);
    expect(showsFab('ERROR')).toBe(false);
  });

  // The week strip is what makes a single empty state safe — it must never be hidden while
  // browsing, or DAY_EMPTY becomes the trap Orders had.
  it('keeps the date navigation mounted whenever browsing', () => {
    expect(showsDateNav('DAY_EMPTY')).toBe(true);
    expect(showsDateNav('CALENDAR_EMPTY')).toBe(true);
    // The strip is also the only way back INTO a single day, so all-dates must never hide it.
    expect(showsDateNav('ALL')).toBe(true);
    expect(showsDateNav('ALL_EMPTY')).toBe(true);
    expect(showsDateNav('SEARCH_IDLE')).toBe(false);
    expect(showsDateNav('ERROR')).toBe(false);
  });
});

describe('headerCollapses', () => {
  it('lets the header hide on the populated browse lists', () => {
    expect(headerCollapses('DAY')).toBe(true);
    expect(headerCollapses('CALENDAR')).toBe(true);
    expect(headerCollapses('ALL')).toBe(true);
  });

  // Search pins its field so the query stays editable; the hero states would strand the user with
  // no search box and no date navigation.
  it('pins the header everywhere else', () => {
    for (const state of [
      'ERROR',
      'LOADING',
      'DAY_EMPTY',
      'CALENDAR_EMPTY',
      'CALENDAR_LOADING',
      'ALL_EMPTY',
      'ALL_LOADING',
      'SEARCH_IDLE',
      'SEARCHING',
      'SEARCH_RESULTS',
      'NO_RESULTS',
    ] as const) {
      expect(headerCollapses(state)).toBe(false);
    }
  });
});

describe('dayDotCount', () => {
  it('renders one dot per appointment below the cap', () => {
    expect(dayDotCount(1)).toBe(1);
    expect(dayDotCount(2)).toBe(2);
    expect(dayDotCount(3)).toBe(3);
  });

  // The branch the preview can't show us: no day in the live data has more than three.
  it('caps a busy day at three dots', () => {
    expect(dayDotCount(4)).toBe(3);
    expect(dayDotCount(97)).toBe(3);
  });

  // Counts are sparse — a day with nothing booked is absent from the map, not zero.
  it('renders nothing for a day with no appointments', () => {
    expect(dayDotCount(0)).toBe(0);
    expect(dayDotCount(undefined)).toBe(0);
  });
});
