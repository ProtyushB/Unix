import {
  DEFAULT_FILTERS,
  REASON_CHIPS,
  appliedFilterChips,
  cardMetaLine,
  deriveWastageView,
  hasActiveFilters,
  headerCollapses,
  poolLabel,
  quickActionsFor,
  reasonLabel,
  showsFab,
  toQuery,
  type WastageViewInput,
} from './wastage.view';

const base: WastageViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 0,
  loadedOnce: false,
  hasError: false,
  filtered: false,
};

describe('deriveWastageView', () => {
  it('puts ERROR ahead of everything, including a search in progress', () => {
    expect(deriveWastageView({ ...base, hasError: true })).toBe('ERROR');
    expect(deriveWastageView({ ...base, hasError: true, mode: 'search', query: 'serum' })).toBe(
      'ERROR',
    );
  });

  it('does not call a focused-but-empty search box a search', () => {
    expect(deriveWastageView({ ...base, mode: 'search' })).toBe('SEARCH_IDLE');
  });

  it('walks a search from SEARCHING to results or no-results', () => {
    expect(deriveWastageView({ ...base, mode: 'search', query: 'serum' })).toBe('SEARCHING');
    expect(deriveWastageView({ ...base, mode: 'search', query: 'serum', loadedOnce: true })).toBe(
      'NO_RESULTS',
    );
    expect(
      deriveWastageView({
        ...base,
        mode: 'search',
        query: 'serum',
        loadedOnce: true,
        rowCount: 2,
      }),
    ).toBe('SEARCH_RESULTS');
  });

  it('stays LOADING until a request has actually COMPLETED', () => {
    // Not `!loading`: that flag is false on the very first render, so a plain negation marks the
    // screen loaded before any request exists.
    expect(deriveWastageView(base)).toBe('LOADING');
  });

  it('tells "none yet" apart from "none match these filters"', () => {
    expect(deriveWastageView({ ...base, loadedOnce: true })).toBe('EMPTY');
    expect(deriveWastageView({ ...base, loadedOnce: true, filtered: true })).toBe('FILTERED_EMPTY');
  });

  it('separates a filtered list from a plain one even when both have rows', () => {
    expect(deriveWastageView({ ...base, loadedOnce: true, rowCount: 4 })).toBe('MAIN');
    expect(deriveWastageView({ ...base, loadedOnce: true, rowCount: 4, filtered: true })).toBe(
      'FILTERED',
    );
  });
});

describe('headerCollapses', () => {
  it('collapses only where there is a list to scroll', () => {
    expect(headerCollapses('MAIN')).toBe(true);
    expect(headerCollapses('FILTERED')).toBe(true);
    expect(headerCollapses('SEARCH_RESULTS')).toBe(true);
    expect(headerCollapses('EMPTY')).toBe(false);
    expect(headerCollapses('LOADING')).toBe(false);
    expect(headerCollapses('FILTERED_EMPTY')).toBe(false);
  });
});

describe('showsFab', () => {
  it('is hidden wherever a hero CTA already offers Record', () => {
    expect(showsFab('EMPTY')).toBe(false);
    expect(showsFab('ERROR')).toBe(false);
    expect(showsFab('NO_RESULTS')).toBe(false);
    expect(showsFab('SEARCH_IDLE')).toBe(false);
  });

  it('shows on a list, and on a filtered-empty one whose hero offers Clear filters instead', () => {
    expect(showsFab('MAIN')).toBe(true);
    expect(showsFab('FILTERED')).toBe(true);
    expect(showsFab('FILTERED_EMPTY')).toBe(true);
  });
});

describe('filters', () => {
  it('starts unfiltered and newest-first', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(DEFAULT_FILTERS.sortDir).toBe('desc');
  });

  it('counts a reason and a flipped sort order as narrowing', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, reason: 'EXPIRED' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sortDir: 'asc' })).toBe(true);
  });

  it('sends null rather than the string "ALL"', () => {
    expect(toQuery(DEFAULT_FILTERS).reason).toBeNull();
    expect(toQuery({ reason: 'DAMAGED', sortDir: 'desc' }).reason).toBe('DAMAGED');
  });

  it('sends NO pool filter, because the endpoint reads none', () => {
    // `inventoryType` is on every record and is SORTABLE, which makes a Product/Raw toggle the
    // obvious thing to build — and it would look like it worked while returning everything.
    expect(Object.keys(toQuery(DEFAULT_FILTERS))).not.toContain('inventoryType');
  });
});

describe('reasonLabel', () => {
  it('labels all SEVEN offerable reasons', () => {
    expect(reasonLabel('EXPIRED')).toBe('Expired');
    expect(reasonLabel('DAMAGED')).toBe('Damaged');
    expect(reasonLabel('SPILLED')).toBe('Spilled');
    expect(reasonLabel('CONTAMINATED')).toBe('Contaminated');
    expect(reasonLabel('THEFT')).toBe('Theft');
    expect(reasonLabel('LOST')).toBe('Lost');
    expect(reasonLabel('OTHER')).toBe('Other');
  });

  it('also labels CORRECTION, which no chip offers but a record can carry', () => {
    // A label function that only knew the chip list would render a blank where an existing
    // system-written record's reason goes.
    expect(reasonLabel('CORRECTION')).toBe('Correction');
  });

  it('renders a dash for a record with no reason, rather than an empty slot', () => {
    expect(reasonLabel(null)).toBe('—');
    expect(reasonLabel(undefined)).toBe('—');
  });
});

describe('REASON_CHIPS', () => {
  it('offers SEVEN reasons plus an All head — CORRECTION is deliberately absent', () => {
    // Offering it would invite someone reconciling a stock miscount to file it as wastage, and the
    // write-off value would absorb an error that was never a loss.
    expect(REASON_CHIPS).toHaveLength(8);
    expect(REASON_CHIPS[0]).toEqual({ value: 'ALL', label: 'All Reasons' });
    expect(REASON_CHIPS.map((c) => c.value)).not.toContain('CORRECTION');
  });

  it('carries no counts, because no endpoint reports any', () => {
    for (const chip of REASON_CHIPS) {
      expect(chip.label).not.toMatch(/\d/);
    }
  });
});

describe('poolLabel', () => {
  it('names the pool a record came out of', () => {
    expect(poolLabel('PRODUCT_INVENTORY')).toBe('Product');
    expect(poolLabel('RAW_INVENTORY')).toBe('Raw');
  });

  it('is empty rather than guessing when the record carries no pool', () => {
    // Defaulting to Product would put the loss against the wrong stock in every read of the row.
    expect(poolLabel(null)).toBe('');
  });
});

describe('appliedFilterChips', () => {
  it('is empty when nothing is narrowing, so no chip strip renders', () => {
    expect(appliedFilterChips(DEFAULT_FILTERS)).toEqual([]);
  });

  it('names each axis that IS narrowing', () => {
    expect(appliedFilterChips({ reason: 'EXPIRED', sortDir: 'desc' })).toEqual(['Expired']);
    expect(appliedFilterChips({ reason: 'ALL', sortDir: 'asc' })).toEqual(['Oldest first']);
    expect(appliedFilterChips({ reason: 'THEFT', sortDir: 'asc' })).toEqual([
      'Theft',
      'Oldest first',
    ]);
  });

  it('never produces a pool chip, because there is no pool filter to produce one from', () => {
    const chips = appliedFilterChips({ reason: 'EXPIRED', sortDir: 'asc' });
    expect(chips.join(' ')).not.toMatch(/Product|Raw/);
  });
});

describe('cardMetaLine', () => {
  it('joins the timestamp and the note with a `·`, never a `+`', () => {
    expect(
      cardMetaLine({ whenText: '22 Jul 2026, 10:15 AM', notesSnippet: 'Left in the sun' }),
    ).toBe('22 Jul 2026, 10:15 AM · Left in the sun');
  });

  it('leaves no dangling separator when either half is missing', () => {
    expect(cardMetaLine({ whenText: '22 Jul 2026, 10:15 AM', notesSnippet: '' })).toBe(
      '22 Jul 2026, 10:15 AM',
    );
    expect(cardMetaLine({ whenText: '', notesSnippet: 'Left in the sun' })).toBe('Left in the sun');
    expect(cardMetaLine({ whenText: '', notesSnippet: '' })).toBe('');
  });
});

describe('quickActionsFor', () => {
  const record = { id: 3 };

  it('offers View and Delete, and nothing else — a wastage is immutable', () => {
    // No status change and no edit: the backend has no PUT and there is no lifecycle to move.
    expect(quickActionsFor(record, { wastageEnabled: true }).map((a) => a.id)).toEqual([
      'view',
      'delete',
    ]);
  });

  it('says what Delete DOES, because a bare "Delete" hides the restock', () => {
    const del = quickActionsFor(record, { wastageEnabled: true })[1];
    expect(del.disabled).toBe(false);
    expect(del.sub).toMatch(/Restocks/i);
    expect(del.destructive).toBe(true);
  });

  it('DISABLES Delete with its reason when the tab is off, rather than hiding it', () => {
    // The endpoint is @TabGated(WASTAGE) and would 403. An action that silently disappears reads
    // as a bug, and the user has no way to learn that a switch elsewhere took it away.
    const del = quickActionsFor(record, { wastageEnabled: false })[1];
    expect(del.disabled).toBe(true);
    expect(del.sub).toMatch(/Wastage tab/i);
  });

  it('disables Delete for a record with no id at all', () => {
    expect(quickActionsFor(null, { wastageEnabled: true })[1].disabled).toBe(true);
  });
});
