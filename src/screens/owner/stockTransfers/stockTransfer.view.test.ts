import {
  DEFAULT_FILTERS,
  deriveStockTransfersView,
  hasActiveFilters,
  headerCollapses,
  showsFab,
  toQuery,
  type StockTransfersViewInput,
} from './stockTransfer.view';

const base: StockTransfersViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 0,
  loadedOnce: false,
  hasError: false,
  filtered: false,
};

describe('deriveStockTransfersView', () => {
  it('puts ERROR ahead of everything, including a search in progress', () => {
    expect(deriveStockTransfersView({ ...base, hasError: true })).toBe('ERROR');
    expect(
      deriveStockTransfersView({ ...base, hasError: true, mode: 'search', query: 'argan' }),
    ).toBe('ERROR');
  });

  it('does not call a focused-but-empty search box a search', () => {
    expect(deriveStockTransfersView({ ...base, mode: 'search' })).toBe('SEARCH_IDLE');
  });

  it('walks a search from SEARCHING to results or no-results', () => {
    expect(deriveStockTransfersView({ ...base, mode: 'search', query: 'argan' })).toBe('SEARCHING');
    expect(
      deriveStockTransfersView({ ...base, mode: 'search', query: 'argan', loadedOnce: true }),
    ).toBe('NO_RESULTS');
    expect(
      deriveStockTransfersView({
        ...base,
        mode: 'search',
        query: 'argan',
        loadedOnce: true,
        rowCount: 3,
      }),
    ).toBe('SEARCH_RESULTS');
  });

  it('stays LOADING until a request has actually COMPLETED', () => {
    expect(deriveStockTransfersView(base)).toBe('LOADING');
  });

  it('tells "none yet" apart from "none match these filters"', () => {
    expect(deriveStockTransfersView({ ...base, loadedOnce: true })).toBe('EMPTY');
    expect(deriveStockTransfersView({ ...base, loadedOnce: true, filtered: true })).toBe(
      'FILTERED_EMPTY',
    );
  });

  it('separates a filtered list from a plain one even when both have rows', () => {
    expect(deriveStockTransfersView({ ...base, loadedOnce: true, rowCount: 4 })).toBe('MAIN');
    expect(
      deriveStockTransfersView({ ...base, loadedOnce: true, rowCount: 4, filtered: true }),
    ).toBe('FILTERED');
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
  it('is hidden wherever a hero CTA already offers Transfer', () => {
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
  it('starts newest-first and unfiltered', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(DEFAULT_FILTERS.sortDir).toBe('desc');
  });

  it('counts a flipped sort order as narrowing', () => {
    expect(hasActiveFilters({ sortDir: 'asc' })).toBe(true);
  });

  it('sends NO `reason`, because the transfer controller reads none', () => {
    // The difference from consumption and wastage, and the reason `StockTransferQuery` omits the
    // key: `reason` is SORTABLE but not FILTERABLE here. A sheet copied from wastage would grow
    // reason chips that appear to work and silently return the unfiltered list.
    expect(Object.keys(toQuery(DEFAULT_FILTERS))).toEqual(['sortDir']);
  });

  it('sends no direction filter either — sourceType/destType are sortable, not filterable', () => {
    const keys = Object.keys(toQuery(DEFAULT_FILTERS));
    expect(keys).not.toContain('sourceType');
    expect(keys).not.toContain('destType');
  });
});
