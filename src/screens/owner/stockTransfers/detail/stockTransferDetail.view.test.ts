import {
  deriveDetailView,
  directionalReason,
  errorSummary,
  hasErrors,
  isCrossPool,
  isEditable,
  oppositePool,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  showsDelete,
  showsEditCta,
  type DetailViewInput,
} from './stockTransferDetail.view';

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

  it('has NO edit affordance at all — a transfer is immutable', () => {
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

describe('direction', () => {
  it('makes the destination a FUNCTION of the source, never a second free choice', () => {
    // A transfer is always cross-pool; same-to-same is refused server-side.
    expect(oppositePool('PRODUCT_INVENTORY')).toBe('RAW_INVENTORY');
    expect(oppositePool('RAW_INVENTORY')).toBe('PRODUCT_INVENTORY');
  });

  it('DERIVES the reason from the pools', () => {
    // `PRODUCT_TO_RAW` with sourceType RAW_INVENTORY is ACCEPTED by the server and is a lie in the
    // audit log. Nothing rejects it, so nothing but this may produce the pairing.
    expect(directionalReason('PRODUCT_INVENTORY', 'RAW_INVENTORY')).toBe('PRODUCT_TO_RAW');
    expect(directionalReason('RAW_INVENTORY', 'PRODUCT_INVENTORY')).toBe('RAW_TO_PRODUCT');
  });

  it('names no direction for a same-pool pair, and does not crash naming it', () => {
    // The validator is what refuses the save; a label function is the wrong place to throw.
    expect(directionalReason('RAW_INVENTORY', 'RAW_INVENTORY')).toBe('OTHER');
  });

  it('rejects a same-pool pair, which would move nothing', () => {
    expect(isCrossPool('PRODUCT_INVENTORY', 'RAW_INVENTORY')).toBe(true);
    expect(isCrossPool('RAW_INVENTORY', 'RAW_INVENTORY')).toBe(false);
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
