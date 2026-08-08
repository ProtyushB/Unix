import { emptyForm, type ConsumptionFormState } from './consumptionDetail.model';
import {
  appBarSubtitle,
  appBarTitle,
  deleteWarning,
  deriveDetailView,
  enteredAsLine,
  errorSummary,
  fefoHelperLine,
  hasErrors,
  isConsumedAtInFuture,
  isEditable,
  nowIst,
  rawStockValue,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  showsDelete,
  showsEditCta,
  validateConsumption,
  type DetailViewInput,
} from './consumptionDetail.view';

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
    // The specific bug: falling through to LOADING renders a spinner over an empty form the user is
    // trying to fill in.
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

  it('has NO edit affordance at all — a consumption is immutable', () => {
    // Named rather than omitted so its absence reads as a decision. The backend has no PUT; an Edit
    // button could only ever 404.
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

  it('is re-armed by clearing the held rows — that is how a just-created product gets listed', () => {
    expect(shouldLoadCatalog({ mode: 'add', hasRows: false, loading: false })).toBe(true);
  });
});

describe('shouldResumeProductPick', () => {
  it('skips the FIRST focus, which every screen in this app fires on mount', () => {
    // Acting on it would reopen the picker over a form nobody has touched.
    expect(shouldResumeProductPick({ awaitingProduct: true, isFirstFocus: true })).toBe(false);
    expect(shouldResumeProductPick({ awaitingProduct: true, isFirstFocus: false })).toBe(true);
    expect(shouldResumeProductPick({ awaitingProduct: false, isFirstFocus: false })).toBe(false);
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
  it('names the action while composing and the product once saved', () => {
    expect(appBarTitle('add', '')).toBe('Record Consumption');
    expect(appBarTitle('add', 'Bleach Powder')).toBe('Record Consumption');
    expect(appBarTitle('view', 'Bleach Powder')).toBe('Bleach Powder');
  });

  it('never renders a blank title for a record whose product name is gone', () => {
    expect(appBarTitle('view', '')).toBe('Consumption');
    expect(appBarTitle('view', '   ')).toBe('Consumption');
    expect(appBarTitle('view', null)).toBe('Consumption');
  });

  it('says what the form DOES, and says nothing on the read screen', () => {
    expect(appBarSubtitle('add')).toBe('Deduct raw stock');
    expect(appBarSubtitle('view')).toBe('');
  });
});

describe('rawStockValue', () => {
  it('tells "not known yet" apart from "the shelf is empty"', () => {
    // "0 g" while a fetch is in flight tells a user with 180 g on hand that they cannot record
    // anything. The dash is the honest placeholder.
    expect(rawStockValue(null, 'g')).toBe('—');
    expect(rawStockValue(undefined, 'g')).toBe('—');
    expect(rawStockValue(0, 'g')).toBe('0 g');
    expect(rawStockValue(180, 'g')).toBe('180 g');
  });

  it('does not pluralise a measure symbol', () => {
    expect(rawStockValue(200, 'ml')).toBe('200 ml');
    expect(rawStockValue(2, 'bottle')).toBe('2 bottles');
  });
});

describe('fefoHelperLine', () => {
  it('names the batch count and the FEFO order', () => {
    expect(fefoHelperLine(3)).toBe(
      'Across 3 active RAW batches · deducted FEFO (soonest expiry first).',
    );
    expect(fefoHelperLine(1)).toBe(
      'Across 1 active RAW batch · deducted FEFO (soonest expiry first).',
    );
  });

  it('DROPS the count rather than guessing one — "0 batches" would contradict the total above it', () => {
    expect(fefoHelperLine(null)).toBe('Stock is deducted FEFO (soonest expiry first).');
    expect(fefoHelperLine(undefined)).toMatch(/FEFO/);
    expect(fefoHelperLine(null)).not.toMatch(/\d/);
  });
});

describe('enteredAsLine', () => {
  it('restates a MIXED entry and names the batch it came out of', () => {
    expect(
      enteredAsLine({ qtyText: '1 scoop · 15 g', mixed: true, batchText: 'BATCH-260722-03' }),
    ).toBe('Entered as 1 scoop · 15 g — deducted FEFO from BATCH-260722-03.');
  });

  it('drops "Entered as" for a single level, which would only restate the figure above it', () => {
    expect(enteredAsLine({ qtyText: '45 g', mixed: false, batchText: 'BATCH-260722-03' })).toBe(
      'Deducted FEFO from BATCH-260722-03.',
    );
  });

  it('stays a sentence when the ledger is unknown, rather than going blank', () => {
    // The trap this shape avoids: a copied stock-transfer TABLE reads `record.lines`, which is
    // undefined on a consumption, and renders empty with no error at all.
    expect(enteredAsLine({ qtyText: '45 g', mixed: false, batchText: '' })).toBe(
      'Deducted FEFO from the soonest-expiring batches.',
    );
  });
});

describe('deleteWarning', () => {
  it('names the amount and where it goes back to', () => {
    expect(deleteWarning({ baseQty: 45, baseUnit: 'g', batchText: 'BATCH-260722-03' })).toBe(
      'Deleting restocks 45 g to BATCH-260722-03. This can’t be undone.',
    );
  });

  it('degrades without ever dropping the sentence', () => {
    const vague = deleteWarning({ baseQty: null, baseUnit: 'g', batchText: '' });
    expect(vague).toBe(
      'Deleting restocks the deducted quantity to its source batch(es). This can’t be undone.',
    );
  });
});

describe('nowIst', () => {
  it('renders the Asia/Kolkata wall clock, not the device’s', () => {
    // 2026-08-05T12:00:00Z is 17:30 in IST. A client comparing against its own zone disagrees with
    // the backend for anyone travelling, and for everyone during the hours the days differ.
    expect(nowIst(new Date('2026-08-05T12:00:00Z'))).toBe('2026-08-05T17:30:00');
  });

  it('rolls the DAY over at the IST boundary, not at UTC midnight', () => {
    // 19:00Z is already 00:30 the NEXT day in IST.
    expect(nowIst(new Date('2026-08-05T19:00:00Z'))).toBe('2026-08-06T00:30:00');
  });

  it('renders midnight as 00, never as the "24" some ICU builds produce', () => {
    expect(nowIst(new Date('2026-08-05T18:30:00Z'))).toBe('2026-08-06T00:00:00');
  });
});

describe('isConsumedAtInFuture', () => {
  // 12:00Z === 17:30 IST.
  const now = new Date('2026-08-05T12:00:00Z');

  it('allows now, and the past', () => {
    expect(isConsumedAtInFuture('2026-08-05T17:30:00', now)).toBe(false);
    expect(isConsumedAtInFuture('2026-08-05T09:00:00', now)).toBe(false);
    expect(isConsumedAtInFuture('2020-01-01T00:00:00', now)).toBe(false);
  });

  it('allows the two-minute grace the server allows, and refuses past it', () => {
    // Not politeness: the value is composed on the device and judged on the server, so a clock a
    // few seconds fast would make "now" itself illegal — the commonest thing anyone records.
    expect(isConsumedAtInFuture('2026-08-05T17:31:59', now)).toBe(false);
    expect(isConsumedAtInFuture('2026-08-05T17:32:00', now)).toBe(false);
    expect(isConsumedAtInFuture('2026-08-05T17:32:01', now)).toBe(true);
    expect(isConsumedAtInFuture('2026-08-06T09:00:00', now)).toBe(true);
  });

  it('judges nothing it cannot parse', () => {
    expect(isConsumedAtInFuture('', now)).toBe(false);
    expect(isConsumedAtInFuture('rubbish', now)).toBe(false);
  });
});

describe('validateConsumption', () => {
  const now = new Date('2026-08-05T12:00:00Z');
  const filled = (over: Partial<ConsumptionFormState> = {}): ConsumptionFormState => ({
    ...emptyForm(),
    itemId: 21,
    itemName: 'Bleach Powder',
    unitRows: [{ unit: 'g', perStock: 1, qty: 45 }],
    consumedAt: '2026-08-05T17:00:00',
    ...over,
  });

  it('passes a complete form', () => {
    expect(validateConsumption(filled(), { availableBaseQty: 180, baseUnit: 'g', now })).toEqual(
      {},
    );
  });

  it('names the field rather than the form', () => {
    expect(validateConsumption(filled({ itemId: null }), { now }).itemId).toBe('Pick a product');
    expect(validateConsumption(filled({ unitRows: [] }), { now }).quantity).toBe(
      'Enter a quantity',
    );
  });

  it('treats an all-zero editor as no quantity, so a zero is never posted', () => {
    const zeroed = filled({ unitRows: [{ unit: 'g', perStock: 1, qty: 0 }] });
    expect(validateConsumption(zeroed, { now }).quantity).toBe('Enter a quantity');
  });

  it('catches an over-draw HERE, with the number already on screen', () => {
    const errors = validateConsumption(filled(), { availableBaseQty: 30, baseUnit: 'g', now });
    expect(errors.quantity).toBe('Only 30 g in RAW stock');
  });

  it('compares the over-draw in BASE units, across a mixed entry', () => {
    // 1 scoop of 30 plus 15 g is 45 base units, not 16 rows-worth of anything.
    const mixed = filled({
      unitRows: [
        { unit: 'scoop', perStock: 30, qty: 1 },
        { unit: 'g', perStock: 1, qty: 15 },
      ],
    });
    expect(validateConsumption(mixed, { availableBaseQty: 45, baseUnit: 'g', now })).toEqual({});
    expect(validateConsumption(mixed, { availableBaseQty: 44, baseUnit: 'g', now }).quantity).toBe(
      'Only 44 g in RAW stock',
    );
  });

  it('SKIPS the over-draw check while the stock figure is unknown', () => {
    // Refusing a quantity because a fetch has not landed blocks a user whose stock is fine.
    expect(validateConsumption(filled(), { now }).quantity).toBeUndefined();
    expect(validateConsumption(filled(), { availableBaseQty: null, now }).quantity).toBeUndefined();
  });

  it('guards the enum, because a bad one is a 500 with nothing readable in it', () => {
    const bad = filled({ reason: 'WASTED' as ConsumptionFormState['reason'] });
    expect(validateConsumption(bad, { now }).reason).toBe('Pick a consumption reason');
  });

  it('requires consumedAt and refuses one more than two minutes ahead', () => {
    expect(validateConsumption(filled({ consumedAt: '' }), { now }).consumedAt).toBe(
      'Pick when this was used',
    );
    expect(
      validateConsumption(filled({ consumedAt: '2026-08-06T09:00:00' }), { now }).consumedAt,
    ).toBe('Consumed at cannot be in the future');
  });

  it('reports the TOP-most failure first, so the toast points up the form', () => {
    const empty = validateConsumption({ ...emptyForm(), consumedAt: '' }, { now });
    expect(errorSummary(empty)).toBe('Pick a product');
  });
});
