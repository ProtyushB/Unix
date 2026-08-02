import {
  deriveProductView,
  showsProductAdd,
  productHeaderCollapses,
  isProductSearchView,
  showsCatalogPanel,
  quickActionsFor,
  sortTriggerLabel,
  sortOptionFor,
  SORT_OPTIONS,
  DEFAULT_SORT_KEY,
  type ProductViewInput,
} from './product.view';
import type {ProductRow} from './product.model';

const base: ProductViewInput = {
  mode: 'browse',
  query: '',
  rowCount: 1,
  loadedOnce: true,
  hasError: false,
};
const v = (over: Partial<ProductViewInput> = {}) => deriveProductView({...base, ...over});

describe('deriveProductView', () => {
  it('shows the populated list', () => {
    expect(v()).toBe('MAIN');
  });

  // A failed load makes every other distinction meaningless — an empty list from a request that
  // never returned is not "no products yet".
  it('lets an error outrank everything, including an active search', () => {
    expect(v({hasError: true})).toBe('ERROR');
    expect(v({hasError: true, mode: 'search', query: 'aloe'})).toBe('ERROR');
    expect(v({hasError: true, loadedOnce: false})).toBe('ERROR');
  });

  // `loading` is false on the very first render, so a plain `!loading` would mark the screen loaded
  // before any request exists and flash EMPTY at a business that has products.
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
      expect(v({mode: 'search', query: 'sham', loadedOnce: false})).toBe('SEARCHING');
    });

    it('splits results from no-results', () => {
      expect(v({mode: 'search', query: 'shampoo', rowCount: 3})).toBe('SEARCH_RESULTS');
      expect(v({mode: 'search', query: 'Sunscreen', rowCount: 0})).toBe('NO_RESULTS');
    });
  });
});

describe('showsProductAdd', () => {
  // Not a FAB — the Products mockups have none. This is the 44px button in the search row.
  it('shows alongside a list or a search', () => {
    expect(showsProductAdd('MAIN')).toBe(true);
    expect(showsProductAdd('LOADING')).toBe(true);
    expect(showsProductAdd('SEARCH_RESULTS')).toBe(true);
    expect(showsProductAdd('NO_RESULTS')).toBe(true);
  });

  it('hides where a hero already owns the primary action', () => {
    expect(showsProductAdd('EMPTY')).toBe(false); // hero offers "Add Product"
    expect(showsProductAdd('ERROR')).toBe(false); // hero offers "Retry"
  });
});

describe('productHeaderCollapses', () => {
  it('collapses only where there is a list to scroll', () => {
    expect(productHeaderCollapses('MAIN')).toBe(true);
    expect(productHeaderCollapses('SEARCH_RESULTS')).toBe(true);
  });

  it('stays pinned on every hero state', () => {
    for (const view of ['EMPTY', 'ERROR', 'LOADING', 'NO_RESULTS', 'SEARCH_IDLE', 'SEARCHING'] as const) {
      expect(productHeaderCollapses(view)).toBe(false);
    }
  });
});

describe('showsCatalogPanel', () => {
  // The mockup swaps the whole "Product Catalog · 142 items · Sort" band for a result count when
  // searching, so the panel is browse-only.
  it('is browse-only', () => {
    expect(showsCatalogPanel('MAIN')).toBe(true);
    expect(showsCatalogPanel('SEARCH_RESULTS')).toBe(false);
    expect(showsCatalogPanel('EMPTY')).toBe(false);
    expect(showsCatalogPanel('ERROR')).toBe(false);
  });
});

describe('isProductSearchView', () => {
  it('covers all four search states and nothing else', () => {
    expect(isProductSearchView('SEARCH_IDLE')).toBe(true);
    expect(isProductSearchView('SEARCHING')).toBe(true);
    expect(isProductSearchView('SEARCH_RESULTS')).toBe(true);
    expect(isProductSearchView('NO_RESULTS')).toBe(true);
    expect(isProductSearchView('MAIN')).toBe(false);
    expect(isProductSearchView('ERROR')).toBe(false);
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
    const whitelisted = ['name', 'price', 'brand', 'productType', 'trackInventory', 'createdAt', 'updatedAt', 'id'];
    for (const opt of SORT_OPTIONS) {
      expect(whitelisted).toContain(opt.sortBy);
    }
  });

  it('shortens the trigger label the way the mockup draws it', () => {
    expect(sortTriggerLabel('name_asc')).toBe('Name');
    expect(sortTriggerLabel('name_desc')).toBe('Name');
    expect(sortTriggerLabel('price_asc')).toBe('Price');
    expect(sortTriggerLabel('created_desc')).toBe('Recently added');
    expect(sortTriggerLabel('brand_asc')).toBe('Brand');
  });

  it('falls back to the default rather than crashing on an unknown key', () => {
    expect(sortOptionFor('nonsense').key).toBe(DEFAULT_SORT_KEY);
    expect(sortTriggerLabel('nonsense')).toBe('Name');
  });
});

describe('quickActionsFor', () => {
  const row = (over: Partial<ProductRow> = {}): ProductRow => ({
    id: 1,
    name: 'Argan Repair Shampoo',
    brand: "L'Oréal Pro",
    price: 420,
    size: '250 ml',
    trackInventory: true,
    availableQuantity: 48,
    availability: true,
    ...over,
  });

  it('offers the mockup\'s three rows in order', () => {
    expect(quickActionsFor(row()).map(a => a.key)).toEqual(['edit', 'tracking', 'delete']);
  });

  // The mockup only ever draws the "off" direction because every product it shows is tracked.
  it('flips the tracking label to match the product', () => {
    expect(quickActionsFor(row({trackInventory: true}))[1].label).toBe('Turn off tracking');
    expect(quickActionsFor(row({trackInventory: false}))[1].label).toBe('Turn on tracking');
  });

  it('marks delete as destructive and gated behind a confirm', () => {
    const del = quickActionsFor(row())[2];
    expect(del.danger).toBe(true);
    expect(del.tint).toBe('error');
    expect(del.confirm).toBe('delete');
  });

  // Edit is drawn in the mockup but has nowhere to navigate — there is no form screen yet. It is
  // rendered rather than omitted so the sheet matches the design, and flagged so the screen no-ops
  // it deliberately instead of pushing a broken route.
  it('marks edit as not yet implemented', () => {
    expect(quickActionsFor(row())[0].todo).toBe(true);
  });

  it('leaves the non-destructive rows undangerous', () => {
    expect(quickActionsFor(row())[0].danger).toBeUndefined();
    expect(quickActionsFor(row())[1].danger).toBeUndefined();
  });
});
