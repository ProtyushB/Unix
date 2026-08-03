import {
  deriveServiceView,
  showsServiceAdd,
  serviceHeaderCollapses,
  isServiceSearchView,
  showsServiceMenuPanel,
  quickActionsFor,
  sortTriggerLabel,
  sortOptionFor,
  SORT_OPTIONS,
  DEFAULT_SORT_KEY,
  type ServiceViewInput,
} from './service.view';
import type {ServiceRow} from './service.model';

const base: ServiceViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 1,
  loadedOnce: true,
  hasError: false,
};
const v = (over: Partial<ServiceViewInput> = {}) => deriveServiceView({...base, ...over});

describe('deriveServiceView', () => {
  it('shows the populated list', () => {
    expect(v()).toBe('MAIN');
  });

  // A failed load makes every other distinction meaningless — an empty list from a request that
  // never returned is not "no services yet".
  it('lets an error outrank everything, including an active search', () => {
    expect(v({hasError: true})).toBe('ERROR');
    expect(v({hasError: true, mode: 'search', query: 'facial'})).toBe('ERROR');
    expect(v({hasError: true, loadedOnce: false})).toBe('ERROR');
  });

  // `loading` is false on the very first render, so a plain `!loading` would mark the screen loaded
  // before any request exists and flash EMPTY at a business that has services.
  it('stays on LOADING until a request has actually completed', () => {
    expect(v({loadedOnce: false, rowCount: 0})).toBe('LOADING');
  });

  it('shows the empty hero only after a completed load returned nothing', () => {
    expect(v({rowCount: 0})).toBe('EMPTY');
  });

  describe('search branch', () => {
    // Rendering "0 results for ''" for a query nobody performed is the bug this state prevents.
    it('treats a focused-but-empty box as idle, not as a search', () => {
      expect(v({mode: 'search', query: ''})).toBe('SEARCH_IDLE');
      expect(v({mode: 'search', query: '', rowCount: 0, loadedOnce: false})).toBe('SEARCH_IDLE');
    });

    it('shows a spinner while the first search request is in flight', () => {
      expect(v({mode: 'search', query: 'faci', loadedOnce: false})).toBe('SEARCHING');
    });

    it('splits results from no-results', () => {
      expect(v({mode: 'search', query: 'Facial', rowCount: 3})).toBe('SEARCH_RESULTS');
      expect(v({mode: 'search', query: 'Botox', rowCount: 0})).toBe('NO_RESULTS');
    });
  });
});

describe('showsServiceAdd', () => {
  it('shows alongside a list or a search', () => {
    expect(showsServiceAdd('MAIN')).toBe(true);
    expect(showsServiceAdd('LOADING')).toBe(true);
    expect(showsServiceAdd('SEARCH_RESULTS')).toBe(true);
    expect(showsServiceAdd('NO_RESULTS')).toBe(true);
  });

  it('hides where a hero already owns the primary action', () => {
    expect(showsServiceAdd('EMPTY')).toBe(false); // hero offers "Add Service"
    expect(showsServiceAdd('ERROR')).toBe(false); // hero offers "Retry"
  });
});

describe('serviceHeaderCollapses', () => {
  it('collapses only where there is a list to scroll', () => {
    expect(serviceHeaderCollapses('MAIN')).toBe(true);
    expect(serviceHeaderCollapses('SEARCH_RESULTS')).toBe(true);
  });

  it('stays pinned on every hero state', () => {
    for (const view of ['EMPTY', 'ERROR', 'LOADING', 'NO_RESULTS', 'SEARCH_IDLE', 'SEARCHING'] as const) {
      expect(serviceHeaderCollapses(view)).toBe(false);
    }
  });
});

describe('showsServiceMenuPanel', () => {
  // The mockup swaps the "Service Menu · 30 services · Sort" band for a result count when
  // searching, so the panel is browse-only.
  it('is browse-only', () => {
    expect(showsServiceMenuPanel('MAIN')).toBe(true);
    expect(showsServiceMenuPanel('SEARCH_RESULTS')).toBe(false);
    expect(showsServiceMenuPanel('EMPTY')).toBe(false);
    expect(showsServiceMenuPanel('ERROR')).toBe(false);
  });
});

describe('isServiceSearchView', () => {
  it('covers all four search states and nothing else', () => {
    expect(isServiceSearchView('SEARCH_IDLE')).toBe(true);
    expect(isServiceSearchView('SEARCHING')).toBe(true);
    expect(isServiceSearchView('SEARCH_RESULTS')).toBe(true);
    expect(isServiceSearchView('NO_RESULTS')).toBe(true);
    expect(isServiceSearchView('MAIN')).toBe(false);
    expect(isServiceSearchView('ERROR')).toBe(false);
  });
});

describe('sort', () => {
  it('defaults to name ascending, which is what the mockup shows', () => {
    expect(DEFAULT_SORT_KEY).toBe('name_asc');
    expect(sortOptionFor(DEFAULT_SORT_KEY).sortBy).toBe('name');
    expect(sortOptionFor(DEFAULT_SORT_KEY).sortDir).toBe('asc');
  });

  // Every option must name a field the server actually whitelists, or it silently sorts by id.
  it('only uses server-whitelisted fields', () => {
    const whitelisted = [
      'id', 'name', 'price', 'duration', 'availability', 'isAppointmentRequired',
      'createdAt', 'updatedAt',
    ];
    for (const opt of SORT_OPTIONS) {
      expect(whitelisted).toContain(opt.sortBy);
    }
  });

  // Duration replaces Products' Brand — a service has no brand.
  it('offers duration and never brand', () => {
    expect(SORT_OPTIONS.map(o => o.sortBy)).toContain('duration');
    expect(SORT_OPTIONS.map(o => o.sortBy)).not.toContain('brand');
  });

  it('shortens the trigger label the way the mockup draws it', () => {
    expect(sortTriggerLabel('name_asc')).toBe('Name');
    expect(sortTriggerLabel('name_desc')).toBe('Name');
    expect(sortTriggerLabel('price_desc')).toBe('Price');
    expect(sortTriggerLabel('duration_asc')).toBe('Duration');
    expect(sortTriggerLabel('duration_desc')).toBe('Duration');
    expect(sortTriggerLabel('created_desc')).toBe('Recently added');
  });

  it('falls back to the default rather than crashing on an unknown key', () => {
    expect(sortOptionFor('nonsense').key).toBe(DEFAULT_SORT_KEY);
    expect(sortTriggerLabel('nonsense')).toBe('Name');
  });
});

describe('quickActionsFor', () => {
  const row = (over: Partial<ServiceRow> = {}): ServiceRow => ({
    id: 1,
    name: 'Bridal Makeup Package',
    description: 'Full bridal look',
    price: 15000,
    duration: 180,
    availability: true,
    ...over,
  });

  // One more than Products has.
  it("offers the mockup's four rows in order", () => {
    expect(quickActionsFor(row()).map(a => a.key)).toEqual([
      'edit',
      'availability',
      'book',
      'delete',
    ]);
  });

  // The mockup only ever draws the "off" direction because every service it shows is available.
  it('flips the availability label to match the service', () => {
    expect(quickActionsFor(row({availability: true}))[1].label).toBe('Mark unavailable');
    expect(quickActionsFor(row({availability: false}))[1].label).toBe('Mark available');
  });

  it('marks delete as destructive and gated behind a confirm', () => {
    const del = quickActionsFor(row())[3];
    expect(del.danger).toBe(true);
    expect(del.tint).toBe('error');
    expect(del.confirm).toBe('delete');
  });

  // Both are drawn in the mockup but have nowhere to navigate — there is no create/edit form and
  // no appointment-booking flow anywhere in the app.
  it('marks edit and book-appointment as not yet implemented', () => {
    expect(quickActionsFor(row())[0].todo).toBe(true);
    expect(quickActionsFor(row())[2].todo).toBe(true);
  });

  it('singles out book-appointment with the accent tint', () => {
    expect(quickActionsFor(row())[2].tint).toBe('accent');
  });

  it('leaves the non-destructive rows undangerous', () => {
    for (const i of [0, 1, 2]) {
      expect(quickActionsFor(row())[i].danger).toBeUndefined();
    }
  });
});
