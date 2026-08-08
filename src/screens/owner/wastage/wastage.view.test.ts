import {
  DEFAULT_FILTERS,
  deriveWastageView,
  hasActiveFilters,
  headerCollapses,
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
