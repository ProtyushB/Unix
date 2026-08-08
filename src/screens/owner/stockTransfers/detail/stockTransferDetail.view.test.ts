import {
  appBarSubtitle,
  appBarTitle,
  deriveDetailView,
  directionalReason,
  errorSummary,
  hasErrors,
  isCrossPool,
  isEditable,
  movingSummary,
  oppositePool,
  reasonHelper,
  reasonSelection,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  showsDelete,
  showsEditCta,
  validateStockTransfer,
  type DetailViewInput,
} from './stockTransferDetail.view';
import { emptyForm, type StockTransferFormState } from './stockTransferDetail.model';

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

describe('reasonSelection', () => {
  it('MOVES the pools when a directional reason is picked', () => {
    // Otherwise picking "Raw → Product" on a Product → Raw form ships a reason that contradicts its
    // own pools — accepted by the server, undetectable afterwards.
    expect(reasonSelection('RAW_TO_PRODUCT', 'PRODUCT_INVENTORY')).toEqual({
      sourceType: 'RAW_INVENTORY',
      destType: 'PRODUCT_INVENTORY',
      reason: 'RAW_TO_PRODUCT',
    });
    expect(reasonSelection('PRODUCT_TO_RAW', 'RAW_INVENTORY')).toEqual({
      sourceType: 'PRODUCT_INVENTORY',
      destType: 'RAW_INVENTORY',
      reason: 'PRODUCT_TO_RAW',
    });
  });

  it('leaves the direction alone for the three reasons that do not name one', () => {
    for (const reason of ['REBALANCE', 'CORRECTION', 'OTHER'] as const) {
      expect(reasonSelection(reason, 'RAW_INVENTORY')).toEqual({
        sourceType: 'RAW_INVENTORY',
        destType: 'PRODUCT_INVENTORY',
        reason,
      });
    }
  });

  it('always returns a CROSS-pool pair, whatever it was handed', () => {
    for (const reason of ['PRODUCT_TO_RAW', 'RAW_TO_PRODUCT', 'REBALANCE', 'OTHER'] as const) {
      for (const source of ['PRODUCT_INVENTORY', 'RAW_INVENTORY'] as const) {
        const next = reasonSelection(reason, source);
        expect(next.sourceType).not.toBe(next.destType);
      }
    }
  });
});

describe('app bar copy', () => {
  it('names the task while composing and the product once saved', () => {
    expect(appBarTitle('add', null)).toBe('Transfer Stock');
    expect(appBarTitle('view', { itemName: 'Argan Oil' })).toBe('Argan Oil');
    expect(appBarTitle('view', { itemName: '  ' })).toBe('Transfer');
    expect(appBarTitle('view', null)).toBe('Transfer');
  });

  it('subtitles only the form', () => {
    expect(appBarSubtitle('add')).toBe('Move stock between pools');
    expect(appBarSubtitle('view')).toBe('');
  });

  it('explains why the reason is pre-filled', () => {
    expect(reasonHelper()).toBe('Auto-set from direction — tap to override');
  });

  it('summarises the direction with an arrow, not a `·`', () => {
    expect(movingSummary('PRODUCT_INVENTORY', 'RAW_INVENTORY')).toBe('Product → Raw');
    expect(movingSummary('RAW_INVENTORY', 'PRODUCT_INVENTORY')).toBe('Raw → Product');
    expect(movingSummary('PRODUCT_INVENTORY', 'RAW_INVENTORY')).not.toContain('·');
  });
});

describe('validateStockTransfer', () => {
  const filled = (over: Partial<StockTransferFormState> = {}): StockTransferFormState => ({
    ...emptyForm(),
    itemId: 21,
    itemName: 'Argan Oil',
    unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }],
    ...over,
  });

  it('passes a complete form', () => {
    expect(validateStockTransfer(filled())).toEqual({});
  });

  it('requires a product — nothing else on the form means anything without one', () => {
    expect(validateStockTransfer(filled({ itemId: null })).itemId).toBe('Pick a product');
  });

  it('refuses a same-pool pair, which moves nothing', () => {
    const errors = validateStockTransfer(filled({ destType: 'PRODUCT_INVENTORY' }));
    expect(errors.sourceType).toBe('Source and destination must be different pools');
  });

  it('refuses a blank or all-zero quantity rather than posting a zero', () => {
    expect(validateStockTransfer(filled({ unitRows: [] })).quantity).toBe('Enter a quantity');
    expect(
      validateStockTransfer(filled({ unitRows: [{ unit: 'ml', perStock: 1, qty: 0 }] })).quantity,
    ).toBe('Enter a quantity');
  });

  it('caps the quantity at what the SOURCE pool holds', () => {
    expect(
      validateStockTransfer(filled({ unitRows: [{ unit: 'ml', perStock: 1, qty: 900 }] }), {
        availableBaseQty: 600,
        baseUnit: 'ml',
      }).quantity,
    ).toBe('Only 600 ml available in the Product pool');
  });

  it('converts through the level before comparing — 2 bottles of 500 is 1000, not 2', () => {
    expect(
      validateStockTransfer(filled({ unitRows: [{ unit: 'bottle', perStock: 500, qty: 2 }] }), {
        availableBaseQty: 600,
        baseUnit: 'ml',
      }).quantity,
    ).toMatch(/Only 600 ml/);
  });

  it('re-runs the ceiling against the FLIPPED direction, which names the other pool', () => {
    // Flipping swaps which pool is the source, and with it how much there is to move.
    const flipped = filled({
      sourceType: 'RAW_INVENTORY',
      destType: 'PRODUCT_INVENTORY',
      reason: 'RAW_TO_PRODUCT',
      unitRows: [{ unit: 'ml', perStock: 1, qty: 900 }],
    });
    expect(validateStockTransfer(flipped, { availableBaseQty: 100, baseUnit: 'ml' }).quantity).toBe(
      'Only 100 ml available in the Raw pool',
    );
  });

  it('skips the ceiling entirely while the stock is UNKNOWN — null is not zero', () => {
    expect(
      validateStockTransfer(filled({ unitRows: [{ unit: 'ml', perStock: 1, qty: 900 }] }), {
        availableBaseQty: null,
      }).quantity,
    ).toBeUndefined();
  });

  it('refuses a reason outside the server enum, because a bad one is a 500 and not a 400', () => {
    const errors = validateStockTransfer(filled({ reason: 'DISPOSAL' as never }));
    expect(errors.reason).toBe('Pick a valid transfer reason');
  });

  it('refuses a reason that CONTRADICTS the pools — nothing server-side catches this', () => {
    // The server accepts `reason: PRODUCT_TO_RAW` alongside `sourceType: RAW_INVENTORY`, and the
    // lie survives in the audit log forever.
    const errors = validateStockTransfer(
      filled({
        sourceType: 'RAW_INVENTORY',
        destType: 'PRODUCT_INVENTORY',
        reason: 'PRODUCT_TO_RAW',
      }),
    );
    expect(errors.reason).toMatch(/moves the other way/);
  });

  it('lets the three NON-directional reasons ride either direction', () => {
    for (const reason of ['REBALANCE', 'CORRECTION', 'OTHER'] as const) {
      expect(validateStockTransfer(filled({ reason })).reason).toBeUndefined();
      expect(
        validateStockTransfer(
          filled({ reason, sourceType: 'RAW_INVENTORY', destType: 'PRODUCT_INVENTORY' }),
        ).reason,
      ).toBeUndefined();
    }
  });

  it('has NO date rule, because the payload cannot carry a date', () => {
    // Both siblings validate their timestamp. This one has no `transferredAt` key on the payload —
    // the controller ignores the field and stamps the row itself — and no date input on the form,
    // so a rule here could never fire. A validator that cannot fire reads as live protection.
    expect(validateStockTransfer(filled({ transferredAt: '2099-01-01T10:00:00' }))).toEqual({});
  });

  it('names the product first, so the toast points at the field furthest up the form', () => {
    const errors = validateStockTransfer(filled({ itemId: null, unitRows: [] }));
    expect(errorSummary(errors)).toBe('Pick a product');
  });

  it('refuses when the source pool resolved NO batch to draw from', () => {
    // The payload is addressed by `sourceBatchId`. Without one the body fails bean validation, and
    // the 400 names a field this form never showed anyone — there is no batch picker.
    expect(validateStockTransfer(filled(), { sourceBatchId: null }).itemId).toBe(
      'No stock to move from the Product pool for this product',
    );
  });

  it('names the pool the batch was looked for in, so a flip changes the message', () => {
    const flipped = filled({
      sourceType: 'RAW_INVENTORY',
      destType: 'PRODUCT_INVENTORY',
      reason: 'RAW_TO_PRODUCT',
    });
    expect(validateStockTransfer(flipped, { sourceBatchId: null }).itemId).toBe(
      'No stock to move from the Raw pool for this product',
    );
  });

  it('tells "the pool has not answered yet" apart from "the pool holds nothing"', () => {
    // `undefined` skips the rule; `null` is a refusal. Collapsing them would refuse every save in
    // the moment between opening the form and the batches landing.
    expect(validateStockTransfer(filled(), {}).itemId).toBeUndefined();
    expect(validateStockTransfer(filled(), { sourceBatchId: undefined }).itemId).toBeUndefined();
    expect(validateStockTransfer(filled(), { sourceBatchId: 41 }).itemId).toBeUndefined();
  });

  it('asks for a product before complaining about its batches', () => {
    // Two errors on one field is noise; "Pick a product" is the useful half.
    expect(validateStockTransfer(filled({ itemId: null }), { sourceBatchId: null }).itemId).toBe(
      'Pick a product',
    );
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
