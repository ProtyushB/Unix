import {
  deriveBillView,
  showsBillFab,
  billHeaderCollapses,
  showsBillChips,
  quickActionsFor,
  type BillViewInput,
} from './bill.view';

/** Browsing, one request completed, one row, no filter. */
const base: BillViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 1,
  loadedOnce: true,
  hasError: false,
  filtered: false,
};

const v = (over: Partial<BillViewInput> = {}) => deriveBillView({ ...base, ...over });

describe('deriveBillView', () => {
  it('shows the list when browsing with rows', () => {
    expect(v()).toBe('MAIN');
    expect(v({ filtered: true })).toBe('FILTERED');
  });

  it('shows the skeleton until the first request completes', () => {
    // Never a plain !loading: loading is false before the first request exists, which would flash
    // EMPTY over a business that has plenty of bills.
    expect(v({ loadedOnce: false })).toBe('LOADING');
  });

  // "No bills yet" on a business with 41 bills is a lie, and the two states need different
  // recoveries — one offers Create, the other offers clearing the filter.
  it('distinguishes an empty business from an empty filter', () => {
    expect(v({ rowCount: 0 })).toBe('EMPTY');
    expect(v({ rowCount: 0, filtered: true })).toBe('FILTERED_EMPTY');
  });

  it('beats every other state with an error', () => {
    // An empty list from a request that never returned is not "no bills yet".
    expect(v({ hasError: true, rowCount: 0 })).toBe('ERROR');
    expect(v({ hasError: true, mode: 'search', query: 'x' })).toBe('ERROR');
    expect(v({ hasError: true, loadedOnce: false })).toBe('ERROR');
  });

  describe('search', () => {
    it('is idle while the box is focused but empty', () => {
      // Guards against "0 results for ''" — a count attributed to a search nobody ran.
      expect(v({ mode: 'search', query: '' })).toBe('SEARCH_IDLE');
      expect(v({ mode: 'search', query: '', rowCount: 0, loadedOnce: false })).toBe('SEARCH_IDLE');
    });

    it('shows progress, then results or nothing', () => {
      expect(v({ mode: 'search', query: 'sharma', loadedOnce: false })).toBe('SEARCHING');
      expect(v({ mode: 'search', query: 'sharma', rowCount: 3 })).toBe('SEARCH_RESULTS');
      expect(v({ mode: 'search', query: 'zomato', rowCount: 0 })).toBe('NO_RESULTS');
    });

    it('ignores the filter chips while searching', () => {
      // Search spans every status, so a stale chip must not turn a hit into FILTERED_EMPTY.
      expect(v({ mode: 'search', query: 'x', rowCount: 0, filtered: true })).toBe('NO_RESULTS');
      expect(v({ mode: 'search', query: 'x', rowCount: 2, filtered: true })).toBe('SEARCH_RESULTS');
    });
  });
});

describe('chrome', () => {
  it('hides the FAB wherever a hero already offers Create', () => {
    expect(showsBillFab('MAIN')).toBe(true);
    expect(showsBillFab('FILTERED_EMPTY')).toBe(true);
    expect(showsBillFab('EMPTY')).toBe(false);
    expect(showsBillFab('ERROR')).toBe(false);
    expect(showsBillFab('NO_RESULTS')).toBe(false);
  });

  it('collapses the header only on the populated browse states', () => {
    expect(billHeaderCollapses('MAIN')).toBe(true);
    expect(billHeaderCollapses('FILTERED')).toBe(true);
    // Pinned, or the user is stranded with no search box and no chips.
    for (const s of ['EMPTY', 'FILTERED_EMPTY', 'ERROR', 'LOADING', 'SEARCH_RESULTS'] as const) {
      expect(billHeaderCollapses(s)).toBe(false);
    }
  });

  it('keeps the chips out of search and error', () => {
    expect(showsBillChips('MAIN')).toBe(true);
    expect(showsBillChips('FILTERED_EMPTY')).toBe(true);
    expect(showsBillChips('SEARCH_RESULTS')).toBe(false);
    expect(showsBillChips('ERROR')).toBe(false);
  });
});

describe('quickActionsFor', () => {
  const keys = (b: string, p: string) => quickActionsFor(b, p).map((a) => a.key);

  it('omits the statuses the bill already has', () => {
    expect(keys('FINALIZED', 'UNPAID')).not.toContain('FINALIZED');
    expect(keys('FINALIZED', 'UNPAID')).toContain('DRAFT');
    expect(keys('FINALIZED', 'PAID')).not.toContain('PAID');
  });

  // The server refuses this with a 409 — cancelling released the items and returned the stock, so
  // there is nothing to reinstate. Offering it could only ever produce an error.
  it('never offers draft on a cancelled bill', () => {
    expect(keys('CANCELLED', 'UNPAID')).not.toContain('DRAFT');
    expect(keys('CANCELLED', 'UNPAID')).toContain('FINALIZED');
  });

  it('marks the actions that need confirming or an amount', () => {
    const actions = quickActionsFor('DRAFT', 'UNPAID');
    expect(actions.find((a) => a.key === 'CANCELLED')?.confirm).toBe('cancel');
    expect(actions.find((a) => a.key === 'FINALIZED')?.confirm).toBe('finalize');
    expect(actions.find((a) => a.key === 'PARTIALLY_PAID')?.needsAmount).toBe(true);
    expect(actions.find((a) => a.key === 'PAID')?.needsAmount).toBeUndefined();
  });

  it('tags each action with the PATCH it maps to', () => {
    const actions = quickActionsFor('DRAFT', 'UNPAID');
    expect(actions.find((a) => a.key === 'CANCELLED')?.axis).toBe('bill');
    expect(actions.find((a) => a.key === 'PAID')?.axis).toBe('payment');
  });
});
