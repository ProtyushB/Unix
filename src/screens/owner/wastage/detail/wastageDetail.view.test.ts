import {
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  poolDescription,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  showsDelete,
  showsEditCta,
  type DetailViewInput,
} from './wastageDetail.view';

const base: DetailViewInput = {
  mode: 'view',
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
};

describe('deriveDetailView', () => {
  it('puts SAVING ahead of everything, so a save cannot be hidden by a stale error', () => {
    expect(deriveDetailView({ ...base, saving: true, hasError: true })).toBe('SAVING');
  });

  it('shows ERROR ahead of a load', () => {
    expect(deriveDetailView({ ...base, hasError: true, loading: true })).toBe('ERROR');
  });

  it('never loads in add mode, because there is nothing to fetch', () => {
    // The specific bug: falling through to LOADING renders a spinner over an empty form.
    expect(deriveDetailView({ ...base, mode: 'add', hasItem: false, loading: true })).toBe('READY');
  });

  it('waits for the record in view mode', () => {
    expect(deriveDetailView({ ...base, hasItem: false })).toBe('LOADING');
    expect(deriveDetailView({ ...base, loading: true })).toBe('LOADING');
    expect(deriveDetailView(base)).toBe('READY');
  });
});

describe('mode gates', () => {
  it('makes fields inputs only while composing', () => {
    expect(isEditable('add')).toBe(true);
    expect(isEditable('view')).toBe(false);
  });

  it('offers Delete only on a saved record', () => {
    expect(showsDelete('view')).toBe(true);
    expect(showsDelete('add')).toBe(false);
  });

  it('has NO edit affordance at all — a wastage is immutable', () => {
    // Named rather than omitted so its absence reads as a decision. The backend has no PUT.
    expect(showsEditCta()).toBe(false);
  });

  it('offers "New Product" only while composing', () => {
    expect(showsCreateProduct('add')).toBe(true);
    expect(showsCreateProduct('view')).toBe(false);
  });
});

describe('shouldLoadCatalog', () => {
  it('fetches once, in add mode, when nothing is held and nothing is in flight', () => {
    expect(shouldLoadCatalog({ mode: 'add', hasRows: false, loading: false })).toBe(true);
    expect(shouldLoadCatalog({ mode: 'add', hasRows: true, loading: false })).toBe(false);
    expect(shouldLoadCatalog({ mode: 'add', hasRows: false, loading: true })).toBe(false);
    expect(shouldLoadCatalog({ mode: 'view', hasRows: false, loading: false })).toBe(false);
  });
});

describe('shouldResumeProductPick', () => {
  it('skips the FIRST focus, which every screen in this app fires on mount', () => {
    expect(shouldResumeProductPick({ awaitingProduct: true, isFirstFocus: true })).toBe(false);
    expect(shouldResumeProductPick({ awaitingProduct: true, isFirstFocus: false })).toBe(true);
    expect(shouldResumeProductPick({ awaitingProduct: false, isFirstFocus: false })).toBe(false);
  });
});

describe('poolDescription', () => {
  it('says what each pool IS, because the two are not interchangeable', () => {
    // Wastage is the only one of the three that asks the user to choose, and choosing wrong writes
    // off real stock of the other kind.
    expect(poolDescription('RAW_INVENTORY')).toMatch(/used during services/);
    expect(poolDescription('PRODUCT_INVENTORY')).toMatch(/decremented on orders/);
  });
});

describe('error helpers', () => {
  it('reports emptiness and names the first offender', () => {
    expect(hasErrors({})).toBe(false);
    expect(errorSummary({})).toBeNull();
    expect(hasErrors({ itemId: 'Pick a product' })).toBe(true);
    expect(errorSummary({ itemId: 'Pick a product', quantity: 'Enter a quantity' })).toBe(
      'Pick a product',
    );
  });
});
