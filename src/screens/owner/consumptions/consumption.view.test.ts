import {
  DEFAULT_FILTERS,
  deriveConsumptionsView,
  hasActiveFilters,
  headerCollapses,
  showsFab,
  toQuery,
  type ConsumptionsViewInput,
} from './consumption.view';

const base: ConsumptionsViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 0,
  loadedOnce: false,
  hasError: false,
  filtered: false,
};

describe('deriveConsumptionsView', () => {
  it('puts ERROR ahead of everything, including a search in progress', () => {
    expect(deriveConsumptionsView({ ...base, hasError: true })).toBe('ERROR');
    expect(
      deriveConsumptionsView({ ...base, hasError: true, mode: 'search', query: 'argan' }),
    ).toBe('ERROR');
  });

  it('does not call a focused-but-empty search box a search', () => {
    // "0 results for ''" is the thing this prevents.
    expect(deriveConsumptionsView({ ...base, mode: 'search' })).toBe('SEARCH_IDLE');
  });

  it('walks a search from SEARCHING to results or no-results', () => {
    expect(deriveConsumptionsView({ ...base, mode: 'search', query: 'argan' })).toBe('SEARCHING');
    expect(
      deriveConsumptionsView({ ...base, mode: 'search', query: 'argan', loadedOnce: true }),
    ).toBe('NO_RESULTS');
    expect(
      deriveConsumptionsView({
        ...base,
        mode: 'search',
        query: 'argan',
        loadedOnce: true,
        rowCount: 3,
      }),
    ).toBe('SEARCH_RESULTS');
  });

  it('stays LOADING until a request has actually COMPLETED', () => {
    // Not `!loading`: that flag is false on the very first render, so a plain negation marks the
    // screen loaded before any request exists and flashes the empty hero at a busy salon.
    expect(deriveConsumptionsView(base)).toBe('LOADING');
  });

  it('tells "none yet" apart from "none match these filters"', () => {
    // The pair that stops a salon with 400 records seeing "No consumptions yet" because they tapped
    // a reason chip. One screen offers Record, the other offers Clear filters.
    expect(deriveConsumptionsView({ ...base, loadedOnce: true })).toBe('EMPTY');
    expect(deriveConsumptionsView({ ...base, loadedOnce: true, filtered: true })).toBe(
      'FILTERED_EMPTY',
    );
  });

  it('separates a filtered list from a plain one even when both have rows', () => {
    expect(deriveConsumptionsView({ ...base, loadedOnce: true, rowCount: 4 })).toBe('MAIN');
    expect(deriveConsumptionsView({ ...base, loadedOnce: true, rowCount: 4, filtered: true })).toBe(
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
    // Two Record affordances on one screen read as two different actions.
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
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, reason: 'TRAINING' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sortDir: 'asc' })).toBe(true);
  });

  it('sends null rather than the string "ALL"', () => {
    // The server reads an absent param as "no filter" and rejects the literal. `compactParams` then
    // drops the key entirely — `reason=` binds to a blank enum and answers 400.
    expect(toQuery(DEFAULT_FILTERS).reason).toBeNull();
    expect(toQuery({ reason: 'SERVICE_USE', sortDir: 'desc' }).reason).toBe('SERVICE_USE');
  });

  it('carries the sort direction through', () => {
    expect(toQuery({ reason: 'ALL', sortDir: 'asc' }).sortDir).toBe('asc');
  });
});
