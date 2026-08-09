import {
  appBarSubtitle,
  appBarTitle,
  batchBreakdownCaption,
  deleteCtaLabel,
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  notesLabel,
  notesRequired,
  pickerHelper,
  poolDescription,
  restockSentence,
  saveCtaLabel,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  showsDelete,
  showsEditCta,
  validateWastage,
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

describe('app-bar copy', () => {
  it('names the action while composing and the item once saved', () => {
    expect(appBarTitle('add', '')).toBe('Record Wastage');
    expect(appBarTitle('view', 'Vitamin C Serum')).toBe('Vitamin C Serum');
    // Never a nameless bar — a record whose product was deleted still has to render.
    expect(appBarTitle('view', '')).toBe('Wastage');
  });

  it('explains the form and says nothing on the read screen', () => {
    expect(appBarSubtitle('add')).toBe('Write off stock');
    expect(appBarSubtitle('view')).toBe('');
  });

  it('names both CTAs for what they DO rather than "Save" and "Delete"', () => {
    expect(saveCtaLabel()).toBe('Record wastage');
    // The restock is the consequence a user cannot discover from the word Delete.
    expect(deleteCtaLabel()).toBe('Delete & restock');
  });
});

describe('picker copy', () => {
  it('names whichever pool the stock column is describing', () => {
    // Both pools carry a real per-row figure now, drawn from one pooled batch read. This line has
    // to track the toggle or it would name a pool the numbers beside it do not belong to — and on
    // Raw there used to be no numbers at all, which is the bug that made it worth pinning.
    expect(pickerHelper('PRODUCT_INVENTORY')).toBe('Showing stock in the Product pool');
    expect(pickerHelper('RAW_INVENTORY')).toBe('Showing stock in the Raw pool');
  });
});

describe('notes', () => {
  it('is compulsory only for OTHER, which says nothing on its own', () => {
    expect(notesRequired('OTHER')).toBe(true);
    expect(notesRequired('EXPIRED')).toBe(false);
    expect(notesRequired(null)).toBe(false);
  });

  it('carries the requirement in the label, so the asterisk cannot disagree with the refusal', () => {
    expect(notesLabel('OTHER')).toMatch(/required/i);
    expect(notesLabel('DAMAGED')).toBe('Notes');
  });
});

describe('the batch ledger copy', () => {
  it('says how many batches, and that the server chose them oldest-first', () => {
    expect(batchBreakdownCaption(2)).toBe('Deducted oldest-first across 2 batches');
    expect(batchBreakdownCaption(1)).toBe('Deducted oldest-first across 1 batch');
  });

  it('is empty at zero rows, so no caption hangs over nothing', () => {
    expect(batchBreakdownCaption(0)).toBe('');
  });

  it('promises the restock batch by batch', () => {
    expect(
      restockSentence([
        { batchId: 4, batchLabel: 'BATCH-260620-04', qtyText: '400 ml' },
        { batchId: 11, batchLabel: 'BATCH-260715-11', qtyText: '200 ml' },
      ]),
    ).toBe('Restocks 400 ml to BATCH-260620-04 and 200 ml to BATCH-260715-11.');
  });

  it('reads naturally for one batch and for three', () => {
    expect(restockSentence([{ batchId: 4, batchLabel: 'B-4', qtyText: '400 ml' }])).toBe(
      'Restocks 400 ml to B-4.',
    );
    expect(
      restockSentence([
        { batchId: 1, batchLabel: 'B-1', qtyText: '1 ml' },
        { batchId: 2, batchLabel: 'B-2', qtyText: '2 ml' },
        { batchId: 3, batchLabel: 'B-3', qtyText: '3 ml' },
      ]),
    ).toBe('Restocks 1 ml to B-1, 2 ml to B-2 and 3 ml to B-3.');
  });

  it('promises nothing when the record carries no ledger', () => {
    expect(restockSentence([])).toBe('');
  });
});

describe('validateWastage', () => {
  const form = {
    itemId: 21,
    itemName: 'Vitamin C Serum',
    inventoryType: 'PRODUCT_INVENTORY' as const,
    reason: 'DAMAGED' as const,
    unitRows: [],
    reportedAt: '',
    notes: '',
  };
  const ctx = { batchId: 88, availableBaseQty: 1000, enteredBaseQty: 100 };

  it('passes a filled-in form', () => {
    expect(validateWastage(form, ctx)).toEqual({});
  });

  it('demands a product first — nothing else on the form means anything without one', () => {
    expect(validateWastage({ ...form, itemId: null }, ctx).itemId).toBe('Pick a product');
  });

  it('refuses a zero, rather than posting a movement that means nothing', () => {
    expect(validateWastage(form, { ...ctx, enteredBaseQty: 0 }).quantity).toBe('Enter a quantity');
  });

  it('caps the quantity at what the CHOSEN POOL holds', () => {
    // The ceiling moves when the pool changes, not only when the quantity does — which is why the
    // available figure is a parameter rather than something read off the form.
    expect(validateWastage(form, { ...ctx, enteredBaseQty: 1001 }).quantity).toMatch(/1000/);
    expect(validateWastage(form, { ...ctx, enteredBaseQty: 1000 }).quantity).toBeUndefined();
  });

  it('does not invent a ceiling before the stock figure is known', () => {
    // Null is "not answered yet", not "the shelf is empty".
    expect(
      validateWastage(form, { ...ctx, availableBaseQty: null, enteredBaseQty: 99999 }).quantity,
    ).toBeUndefined();
  });

  it('refuses when the chosen pool holds no active stock, and names the field that fixes it', () => {
    expect(validateWastage(form, { ...ctx, batchId: null }).inventoryType).toMatch(
      /Inventory Type/,
    );
  });

  it('does not complain about the pool before a product has been picked', () => {
    const errors = validateWastage({ ...form, itemId: null }, { ...ctx, batchId: null });
    expect(errors.inventoryType).toBeUndefined();
  });

  it('accepts all EIGHT reasons, not just the seven chips', () => {
    // A form seeded from an existing CORRECTION record would otherwise fail its own validation.
    expect(validateWastage({ ...form, reason: 'CORRECTION' }, ctx).reason).toBeUndefined();
    expect(validateWastage({ ...form, reason: 'NONSENSE' as never }, ctx).reason).toBe(
      'Pick a reason',
    );
  });

  it('requires a note for OTHER and only for OTHER', () => {
    expect(validateWastage({ ...form, reason: 'OTHER' }, ctx).notes).toBe('Say what happened');
    expect(validateWastage({ ...form, reason: 'OTHER', notes: '  ' }, ctx).notes).toBe(
      'Say what happened',
    );
    expect(
      validateWastage({ ...form, reason: 'OTHER', notes: 'Dropped' }, ctx).notes,
    ).toBeUndefined();
    expect(validateWastage({ ...form, reason: 'LOST' }, ctx).notes).toBeUndefined();
  });

  it('has NO future-date rule, because there is no date field and no server rule to mirror', () => {
    // Unlike consumption's `consumedAt`, the server runs no date validation on `reportedAt` — and
    // the form collects no date at all, so a check here would guard nothing.
    expect(validateWastage({ ...form, reportedAt: '2099-01-01T00:00:00' }, ctx)).toEqual({});
  });
});
