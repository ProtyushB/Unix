import { emptyForm, type BatchFormState } from './batchDetail.model';
import {
  appBarTitle,
  dateBounds,
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  showsDelete,
  showsEditCta,
  typeDescription,
  validateBatch,
  type DetailViewInput,
} from './batchDetail.view';

const TODAY = '2026-08-07';
const NOW = new Date('2026-08-07T06:00:00Z');

const v = (over: Partial<DetailViewInput> = {}): DetailViewInput => ({
  mode: 'view',
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
  ...over,
});

const form = (over: Partial<BatchFormState> = {}): BatchFormState => ({
  ...emptyForm(NOW),
  itemId: 9,
  purchasedQuantity: '50',
  ...over,
});

describe('deriveDetailView', () => {
  it('never loads in add mode — there is nothing to fetch', () => {
    // Falling through to LOADING would spin over a form the user is trying to fill in.
    expect(deriveDetailView(v({ mode: 'add', loading: true, hasItem: false }))).toBe('READY');
  });

  it('walks the view-mode branch', () => {
    expect(deriveDetailView(v({ loading: true, hasItem: false }))).toBe('LOADING');
    expect(deriveDetailView(v({ hasItem: false }))).toBe('LOADING');
    expect(deriveDetailView(v())).toBe('READY');
  });

  it('lets saving and error win, in that order', () => {
    expect(deriveDetailView(v({ saving: true, hasError: true }))).toBe('SAVING');
    expect(deriveDetailView(v({ hasError: true, hasItem: false }))).toBe('ERROR');
  });
});

describe('mode → affordances', () => {
  it('makes fields editable ONLY while adding', () => {
    // Batches are immutable; a saved one is read-only forever.
    expect(isEditable('add')).toBe(true);
    expect(isEditable('view')).toBe(false);
  });

  it('offers no Edit affordance at all', () => {
    // Deliberate: every sibling detail screen has one, and its absence here is a decision.
    expect(showsEditCta()).toBe(false);
  });

  it('offers Delete only on a saved batch', () => {
    expect(showsDelete('view')).toBe(true);
    expect(showsDelete('add')).toBe(false);
  });

  it('titles the bar with the batch number once there is one', () => {
    expect(appBarTitle('add', '')).toBe('Add Batch');
    expect(appBarTitle('view', 'M-BCH-2026-08-07-001')).toBe('M-BCH-2026-08-07-001');
    expect(appBarTitle('view', '')).toBe('Batch');
  });
});

describe('typeDescription', () => {
  it('explains what each pool is for', () => {
    expect(typeDescription('PRODUCT_INVENTORY')).toContain('Sellable');
    expect(typeDescription('RAW_INVENTORY')).toContain('Consumable');
  });
});

describe('validateBatch', () => {
  it('accepts a minimal valid batch', () => {
    expect(validateBatch(form(), TODAY)).toEqual({});
  });

  it('requires a product', () => {
    expect(validateBatch(form({ itemId: null }), TODAY).itemId).toBeDefined();
  });

  it('requires a positive whole purchased quantity', () => {
    expect(validateBatch(form({ purchasedQuantity: '' }), TODAY).purchasedQuantity).toBeDefined();
    expect(validateBatch(form({ purchasedQuantity: '0' }), TODAY).purchasedQuantity).toBeDefined();
    expect(validateBatch(form({ purchasedQuantity: '-5' }), TODAY).purchasedQuantity).toBeDefined();
    // Stored as a whole base-unit count — a fraction cannot be represented.
    expect(
      validateBatch(form({ purchasedQuantity: '2.5' }), TODAY).purchasedQuantity,
    ).toBeDefined();
  });

  it('rejects an expiry of TODAY, not just one in the past', () => {
    // The conservative boundary: a batch expiring today is born EXPIRED and the server refuses it.
    expect(validateBatch(form({ expiryDate: TODAY }), TODAY).expiryDate).toBeDefined();
    expect(validateBatch(form({ expiryDate: '2026-08-06' }), TODAY).expiryDate).toBeDefined();
    expect(validateBatch(form({ expiryDate: '2026-08-08' }), TODAY).expiryDate).toBeUndefined();
  });

  it('rejects an expiry before the manufacture date', () => {
    expect(
      validateBatch(form({ manufactureDate: '2026-09-01', expiryDate: '2026-08-20' }), TODAY)
        .expiryDate,
    ).toBeDefined();
  });

  it('rejects future manufacture and received dates', () => {
    expect(
      validateBatch(form({ manufactureDate: '2026-08-08' }), TODAY).manufactureDate,
    ).toBeDefined();
    expect(validateBatch(form({ receivedDate: '2026-08-08' }), TODAY).receivedDate).toBeDefined();
    // Today is fine for both — only the FUTURE is refused.
    expect(validateBatch(form({ manufactureDate: TODAY, receivedDate: TODAY }), TODAY)).toEqual({});
  });

  it('rejects remaining greater than purchased', () => {
    expect(
      validateBatch(form({ purchasedQuantity: '50', remainingQuantity: '60' }), TODAY)
        .remainingQuantity,
    ).toBeDefined();
    expect(
      validateBatch(form({ purchasedQuantity: '50', remainingQuantity: '50' }), TODAY)
        .remainingQuantity,
    ).toBeUndefined();
  });

  it('treats a blank remaining as "same as purchased", not as zero', () => {
    expect(validateBatch(form({ remainingQuantity: '' }), TODAY)).toEqual({});
  });

  it('allows a remaining of zero — a batch can be entered already spent', () => {
    expect(validateBatch(form({ remainingQuantity: '0' }), TODAY)).toEqual({});
  });
});

describe('hasErrors / errorSummary', () => {
  it('summarises the first error for a toast', () => {
    const errors = validateBatch(form({ itemId: null }), TODAY);
    expect(hasErrors(errors)).toBe(true);
    expect(errorSummary(errors)).toBe('Pick a product');
    expect(hasErrors({})).toBe(false);
    expect(errorSummary({})).toBeNull();
  });
});

describe('dateBounds', () => {
  it('caps manufacture and received at today', () => {
    expect(dateBounds('manufactureDate', form(), TODAY)).toEqual({ max: TODAY });
    expect(dateBounds('receivedDate', form(), TODAY)).toEqual({ max: TODAY });
  });

  it('floors expiry at TOMORROW, matching what validation will accept', () => {
    // A min of today would let the picker offer a date validation then refuses — the worst of both.
    expect(dateBounds('expiryDate', form(), TODAY)).toEqual({ min: '2026-08-08' });
  });

  it('floors expiry at the manufacture date when that is later still', () => {
    expect(dateBounds('expiryDate', form({ manufactureDate: '2026-12-01' }), TODAY)).toEqual({
      min: '2026-12-01',
    });
  });

  it('rolls the month over correctly', () => {
    expect(dateBounds('expiryDate', form(), '2026-08-31')).toEqual({ min: '2026-09-01' });
  });
});
