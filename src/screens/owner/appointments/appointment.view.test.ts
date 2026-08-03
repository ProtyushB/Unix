import {
  deriveView,
  showsFab,
  showsDateNav,
  dayDotCount,
  headerCollapses,
  type ViewInput,
} from './appointment.view';

/** Browsing the day surface, one request completed, one row. */
const base: ViewInput = {
  surface: 'DAY',
  mode: 'browse',
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
    expect(showsFab('SEARCH_RESULTS')).toBe(false);
    expect(showsFab('NO_RESULTS')).toBe(false);
    expect(showsFab('ERROR')).toBe(false);
  });

  // The week strip is what makes a single empty state safe — it must never be hidden while
  // browsing, or DAY_EMPTY becomes the trap Orders had.
  it('keeps the date navigation mounted whenever browsing', () => {
    expect(showsDateNav('DAY_EMPTY')).toBe(true);
    expect(showsDateNav('CALENDAR_EMPTY')).toBe(true);
    expect(showsDateNav('SEARCH_IDLE')).toBe(false);
    expect(showsDateNav('ERROR')).toBe(false);
  });
});

describe('headerCollapses', () => {
  it('lets the header hide on the two browse surfaces', () => {
    expect(headerCollapses('DAY')).toBe(true);
    expect(headerCollapses('CALENDAR')).toBe(true);
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
