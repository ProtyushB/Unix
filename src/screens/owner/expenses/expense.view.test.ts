import {
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_FILTERS,
  REIMBURSEMENT_CHIPS,
  SORT_CHOICES,
  appliedFilterChips,
  deriveExpensesView,
  hasActiveFilters,
  headerCollapses,
  listSubtitle,
  monthRangeIst,
  monthTotal,
  reimbursementPill,
  showsFab,
  sortChoiceKey,
  toQuery,
  type ExpenseFilters,
  type ExpensesViewInput,
} from './expense.view';

const base: ExpensesViewInput = {
  mode: 'browse',
  loading: false,
  loadedOnce: true,
  hasError: false,
  hasRows: true,
  hasQuery: false,
  filtered: false,
};

describe('deriveExpensesView', () => {
  it('puts ERROR ahead of everything, so a failed refresh is not hidden under a spinner', () => {
    expect(deriveExpensesView({ ...base, hasError: true, loading: true })).toBe('ERROR');
  });

  it('shows the first load rather than flashing an empty hero', () => {
    expect(deriveExpensesView({ ...base, loading: true, loadedOnce: false, hasRows: false })).toBe(
      'LOADING',
    );
    // Already loaded once: a refresh keeps the list on screen.
    expect(deriveExpensesView({ ...base, loading: true })).toBe('LIST');
  });

  it('separates an empty catalog from an empty FILTER — they need different copy', () => {
    expect(deriveExpensesView({ ...base, hasRows: false, filtered: false })).toBe('EMPTY');
    expect(deriveExpensesView({ ...base, hasRows: false, filtered: true })).toBe('FILTERED_EMPTY');
  });

  it('walks search: idle → searching → results or none', () => {
    expect(deriveExpensesView({ ...base, mode: 'search', hasQuery: false })).toBe('SEARCH_IDLE');
    expect(deriveExpensesView({ ...base, mode: 'search', hasQuery: true, loading: true })).toBe(
      'SEARCHING',
    );
    expect(deriveExpensesView({ ...base, mode: 'search', hasQuery: true })).toBe('LIST');
    expect(
      deriveExpensesView({ ...base, mode: 'search', hasQuery: true, hasRows: false }),
    ).toBe('NO_RESULTS');
  });
});

describe('the chrome gates', () => {
  it('collapses the header only over a real list', () => {
    expect(headerCollapses('LIST')).toBe(true);
    expect(headerCollapses('EMPTY')).toBe(false);
    expect(headerCollapses('LOADING')).toBe(false);
  });

  it('hides the FAB on EMPTY, where the hero already offers the same action', () => {
    expect(showsFab('LIST')).toBe(true);
    expect(showsFab('FILTERED_EMPTY')).toBe(true);
    expect(showsFab('EMPTY')).toBe(false);
    expect(showsFab('LOADING')).toBe(false);
    expect(showsFab('ERROR')).toBe(false);
  });
});

describe('filters', () => {
  it('starts unfiltered, newest first', () => {
    expect(DEFAULT_FILTERS).toEqual({
      category: 'ALL',
      reimbursement: 'ALL',
      sortBy: 'expenseDate',
      sortDir: 'desc',
    });
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('counts a changed SORT as active, so the filter button tints for it too', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, category: 'UTILITIES' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, reimbursement: 'PENDING' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sortDir: 'asc' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sortBy: 'amount' })).toBe(true);
  });

  it('OMITS a non-filter rather than sending it as null or false', () => {
    // pendingReimbursementOnly:false is silently ignored server-side, so sending it would read as
    // a filter that does nothing. Absence is the only honest way to say "no filter".
    expect(toQuery(DEFAULT_FILTERS)).toEqual({ sortBy: 'expenseDate', sortDir: 'desc' });
    expect(Object.keys(toQuery(DEFAULT_FILTERS))).not.toContain('category');
    expect(Object.keys(toQuery(DEFAULT_FILTERS))).not.toContain('pendingReimbursementOnly');
  });

  it('sends only what was actually chosen', () => {
    const f: ExpenseFilters = {
      category: 'UTILITIES',
      reimbursement: 'PENDING',
      sortBy: 'amount',
      sortDir: 'desc',
    };
    expect(toQuery(f)).toEqual({
      category: 'UTILITIES',
      pendingReimbursementOnly: true,
      sortBy: 'amount',
      sortDir: 'desc',
    });
  });

  it('names the applied filters for the empty hero, using full category labels', () => {
    expect(appliedFilterChips(DEFAULT_FILTERS)).toEqual([]);
    expect(
      appliedFilterChips({ ...DEFAULT_FILTERS, category: 'MAINTENANCE_REPAIR' }),
    ).toEqual(['Maintenance & Repair']);
    expect(
      appliedFilterChips({ ...DEFAULT_FILTERS, category: 'UTILITIES', reimbursement: 'PENDING' }),
    ).toEqual(['Utilities', 'Pending reimburse']);
  });

  it('offers TWO reimbursement chips — "settled only" is not a question the API can answer', () => {
    expect(REIMBURSEMENT_CHIPS.map((c) => c.key)).toEqual(['ALL', 'PENDING']);
  });

  it('offers all 15 categories plus an All row in the sheet', () => {
    expect(CATEGORY_FILTER_OPTIONS).toHaveLength(16);
    expect(CATEGORY_FILTER_OPTIONS[0]).toEqual({ value: 'ALL', label: 'All categories' });
  });

  it('offers four sorts, and never `category` — it sorts by enum name, not by label', () => {
    // "Bank Fees" under B but "Maintenance & Repair" under M: the strings compared server-side are
    // not the ones on screen, so the order looks arbitrary.
    expect(SORT_CHOICES.map((c) => c.key)).toEqual(['newest', 'oldest', 'amount', 'title']);
    expect(SORT_CHOICES.some((c) => c.sortBy === 'category')).toBe(false);
    expect(SORT_CHOICES.some((c) => c.sortBy === 'id')).toBe(false);
  });

  it('maps a filter back to the chosen sort row, defaulting to newest', () => {
    expect(sortChoiceKey(DEFAULT_FILTERS)).toBe('newest');
    expect(sortChoiceKey({ ...DEFAULT_FILTERS, sortDir: 'asc' })).toBe('oldest');
    expect(sortChoiceKey({ ...DEFAULT_FILTERS, sortBy: 'amount' })).toBe('amount');
    // An unrepresented combination falls back rather than leaving nothing selected.
    expect(sortChoiceKey({ ...DEFAULT_FILTERS, sortBy: 'vendorName' })).toBe('newest');
  });
});

describe('monthRangeIst', () => {
  it('starts at the first of the IST month, with an OFFSET — a date-only value is a 500', () => {
    const { from, to } = monthRangeIst(new Date('2026-08-09T12:00:00.000Z'));
    expect(from).toBe('2026-08-01T00:00:00+05:30');
    expect(to).toBe('2026-08-09T12:00:00.000Z');
    expect(from).toMatch(/[Z+]/);
  });

  it('uses the IST month, not the UTC one, near a month boundary', () => {
    // 20:00Z on 31 July is 01:30 IST on 1 August — the month has already turned in IST.
    expect(monthRangeIst(new Date('2026-07-31T20:00:00.000Z')).from).toBe(
      '2026-08-01T00:00:00+05:30',
    );
    // And 23:00Z on 31 August is 04:30 IST on 1 September.
    expect(monthRangeIst(new Date('2026-08-31T23:00:00.000Z')).from).toBe(
      '2026-09-01T00:00:00+05:30',
    );
  });

  it('pads a single-digit month', () => {
    expect(monthRangeIst(new Date('2026-01-15T12:00:00.000Z')).from).toBe(
      '2026-01-01T00:00:00+05:30',
    );
  });
});

describe('monthTotal', () => {
  const totals = { UTILITIES: 19900, RENT_LEASE: 45000, OTHER: 0 };

  it('sums every category for the unfiltered header', () => {
    expect(monthTotal(totals, 'ALL')).toBe(64900);
  });

  it('reads one key when a category is chosen', () => {
    expect(monthTotal(totals, 'UTILITIES')).toBe(19900);
  });

  it('reports a genuinely absent category as zero — the endpoint zero-fills all fifteen', () => {
    expect(monthTotal(totals, 'INSURANCE')).toBe(0);
  });

  it('answers NULL when the map itself is missing — zero is a real answer, unknown is not', () => {
    expect(monthTotal(null, 'ALL')).toBeNull();
    expect(monthTotal(undefined, 'UTILITIES')).toBeNull();
  });
});

describe('listSubtitle', () => {
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  it('renders nothing while the figure is unknown', () => {
    // The header must not claim a number it does not have.
    expect(listSubtitle(null, 'ALL', money)).toBeNull();
  });

  it('names the month and the money, and NEVER a record count', () => {
    // The list endpoint reports totalPages only, so any "24 expenses" here would be invented.
    const out = listSubtitle(68020, 'ALL', money);
    expect(out).toBe('This month · ₹68,020');
    expect(out).not.toMatch(/expenses?/);
  });

  it('names the category when one is filtered to', () => {
    expect(listSubtitle(19900, 'UTILITIES', money)).toBe('This month · Utilities · ₹19,900');
  });

  it('renders a real zero rather than hiding it', () => {
    expect(listSubtitle(0, 'ALL', money)).toBe('This month · ₹0');
  });
});

describe('reimbursementPill', () => {
  it('says nothing for the ordinary company-paid expense', () => {
    // Most expenses are not reimbursable; labelling every one of them turns the exception into
    // noise.
    expect(reimbursementPill('NOT_REIMBURSABLE')).toBeNull();
  });

  it('distinguishes owed from settled', () => {
    expect(reimbursementPill('PENDING')).toEqual({ label: 'Reimburse pending', tone: 'accent' });
    expect(reimbursementPill('SETTLED')).toEqual({ label: 'Reimbursed', tone: 'success' });
  });

  it('only ever returns a tone Badge actually implements', () => {
    // Badge's union is neutral | accent | info | success | error. A pill inventing a sixth would
    // either fail typecheck at the call site or be silently mapped to neutral.
    const badgeTones = ['neutral', 'accent', 'info', 'success', 'error'];
    for (const state of ['PENDING', 'SETTLED'] as const) {
      expect(badgeTones).toContain(reimbursementPill(state)?.tone);
    }
  });
});
