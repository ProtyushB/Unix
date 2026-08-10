import {
  LIST_SUBTITLE,
  PROFILE_REFETCHES,
  SEARCH_PLACEHOLDER,
  deriveCustomersView,
  headerCollapses,
  noResultsTitle,
  profileActivityValue,
  type CustomersViewInput,
} from './customer.view';

const base: CustomersViewInput = {
  mode: 'browse',
  loading: false,
  loadedOnce: true,
  hasError: false,
  hasRows: true,
  hasQuery: false,
};

describe('deriveCustomersView', () => {
  it('puts ERROR ahead of everything', () => {
    expect(deriveCustomersView({ ...base, hasError: true, loading: true })).toBe('ERROR');
  });

  it('shows the first load rather than flashing an empty hero', () => {
    expect(deriveCustomersView({ ...base, loading: true, loadedOnce: false, hasRows: false })).toBe(
      'LOADING',
    );
    expect(deriveCustomersView({ ...base, loading: true })).toBe('LIST');
  });

  it('walks search: idle → searching → results or none', () => {
    expect(deriveCustomersView({ ...base, mode: 'search', hasQuery: false })).toBe('SEARCH_IDLE');
    expect(deriveCustomersView({ ...base, mode: 'search', hasQuery: true, loading: true })).toBe(
      'SEARCHING',
    );
    expect(deriveCustomersView({ ...base, mode: 'search', hasQuery: true })).toBe('LIST');
    expect(deriveCustomersView({ ...base, mode: 'search', hasQuery: true, hasRows: false })).toBe(
      'NO_RESULTS',
    );
  });

  it('has NO filtered-empty state, because there are no filters', () => {
    // The endpoint takes businessId/page/limit/search and sorts lastActivityAt DESC with no way to
    // change it. An empty list can only ever be "none yet" or "none matching a search".
    const states = new Set(
      [
        { ...base, hasRows: false },
        { ...base, hasRows: false, mode: 'search' as const, hasQuery: true },
      ].map(deriveCustomersView),
    );
    expect(states).toEqual(new Set(['EMPTY', 'NO_RESULTS']));
  });

  it('collapses the header only over a real list', () => {
    expect(headerCollapses('LIST')).toBe(true);
    expect(headerCollapses('EMPTY')).toBe(false);
  });
});

describe('the copy', () => {
  it('promises name, email and phone — NOT username', () => {
    // Three server docstrings claim username is searched; the repository query names firstName,
    // lastName, email and phoneNumber, and the query wins.
    expect(SEARCH_PLACEHOLDER).toBe('Search name, email or phone');
    expect(SEARCH_PLACEHOLDER).not.toMatch(/username/i);
  });

  it('carries NO record count in the subtitle', () => {
    // The endpoint reports totalPages and never totalElements, so "142 customers" would be a
    // number nobody sent.
    expect(LIST_SUBTITLE).toBe('Derived from orders, bookings & bills');
    expect(LIST_SUBTITLE).not.toMatch(/\d/);
  });

  it('quotes the query back when nothing matches', () => {
    expect(noResultsTitle('  priya ')).toBe('No match for “priya”.');
  });
});

describe('profileActivityValue', () => {
  it('spells out that the count is finalized BILLS', () => {
    // Without the parenthetical a reader compares it against the order list and concludes one of
    // the two is wrong.
    expect(profileActivityValue(18)).toBe('18 (finalized bills)');
    expect(profileActivityValue(0)).toBe('0 (finalized bills)');
    expect(profileActivityValue(null)).toBe('0 (finalized bills)');
  });
});

describe('the profile does not refetch', () => {
  it('is pinned, because the reason is not visible from the screen', () => {
    // There is no customer-by-id endpoint. GET /persons/{personId} returns a PersonDto with none of
    // the rollups AND is @PreAuthorize("hasAuthority('CUSTOMER')") — an owner's token does not
    // satisfy it. A refetch would blank the four figures the screen exists to show, or 403.
    expect(PROFILE_REFETCHES).toBe(false);
  });
});
