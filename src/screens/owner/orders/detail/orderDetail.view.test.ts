import { toFormState, type OrderFormState } from './orderDetail.model';
import { configFor, PARLOUR_ORDER_CONFIG, PHARMACY_ORDER_CONFIG } from './orderDetail.modules';
import {
  appBarSubtitle,
  appBarTitle,
  canEdit,
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  lockedReason,
  saveLabel,
  showsDelete,
  showsEditCta,
  validateOrder,
} from './orderDetail.view';
import type { OrderLine } from './orderLineUnits';

const READY = {
  mode: 'view' as const,
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
};

describe('deriveDetailView', () => {
  it('saving beats everything, so the overlay is never argued with', () => {
    expect(deriveDetailView({ ...READY, saving: true, hasError: true, hasItem: false })).toBe(
      'SAVING',
    );
  });

  it('shows the error state only when there is nothing to show instead', () => {
    expect(deriveDetailView({ ...READY, hasError: true, hasItem: false })).toBe('ERROR');
    // A failed refresh over an order already on screen must not blank it.
    expect(deriveDetailView({ ...READY, hasError: true, hasItem: true })).toBe('READY');
  });

  it('add mode is ready immediately — there is nothing to fetch', () => {
    // Ordering `loading` first would leave the Add screen spinning forever.
    expect(deriveDetailView({ ...READY, mode: 'add', loading: true, hasItem: false })).toBe(
      'READY',
    );
  });

  it('waits for the record in view and edit mode', () => {
    expect(deriveDetailView({ ...READY, loading: true })).toBe('LOADING');
    expect(deriveDetailView({ ...READY, hasItem: false })).toBe('LOADING');
    expect(deriveDetailView({ ...READY, mode: 'edit', hasItem: false })).toBe('LOADING');
  });
});

describe('mode gates', () => {
  it('edits in edit and add, never in view', () => {
    expect(isEditable('view')).toBe(false);
    expect(isEditable('edit')).toBe(true);
    expect(isEditable('add')).toBe(true);
  });

  it('offers Delete only when editing something that exists', () => {
    expect(showsDelete('edit')).toBe(true);
    expect(showsDelete('add')).toBe(false);
    expect(showsDelete('view')).toBe(false);
  });

  it('shows the Edit FAB only in view', () => {
    expect(showsEditCta('view')).toBe(true);
    expect(showsEditCta('edit')).toBe(false);
  });
});

describe('copy', () => {
  it('titles each mode', () => {
    expect(appBarTitle('add', '')).toBe('New Order');
    expect(appBarTitle('edit', 'ORD-05082026-042')).toBe('ORD-05082026-042');
    expect(appBarTitle('view', 'ORD-05082026-042')).toBe('ORD-05082026-042');
  });

  it('falls back when the order number has not arrived yet', () => {
    expect(appBarTitle('view', '')).toBe('Order details');
    expect(appBarTitle('edit', '')).toBe('Edit order');
  });

  it('subtitles each mode as drawn', () => {
    expect(appBarSubtitle('add')).toBe('Add a customer and items');
    expect(appBarSubtitle('edit')).toBe('Edit order');
  });

  it('labels Save differently when creating', () => {
    expect(saveLabel('add')).toBe('Save Order');
    expect(saveLabel('edit')).toBe('Save Changes');
  });
});

describe('locks', () => {
  it('refuses to edit a billed order, and names the bill when it can', () => {
    expect(canEdit(false)).toBe(true);
    expect(canEdit(true)).toBe(false);
    expect(lockedReason('BILL-05082026-014')).toContain('BILL-05082026-014');
    expect(lockedReason(null)).toContain('on a bill');
  });
});

describe('validateOrder', () => {
  const line = (over: Partial<OrderLine> = {}): OrderLine =>
    ({
      productId: 5,
      quantity: 1,
      itemPrice: 10,
      totalPrice: 10,
      discount: 0,
      ...over,
    }) as OrderLine;

  const form = (over: Partial<OrderFormState> = {}): OrderFormState => ({
    ...toFormState(null),
    customerId: 7,
    lines: [line()],
    ...over,
  });

  it('passes a complete order', () => {
    expect(hasErrors(validateOrder(form()))).toBe(false);
  });

  it('requires a customer, because customer_id is NOT NULL and would 500', () => {
    // The controller has no @Valid, so nothing server-side catches this before Postgres does.
    expect(validateOrder(form({ customerId: null })).customer).toBeTruthy();
  });

  it('requires at least one line', () => {
    expect(validateOrder(form({ lines: [] })).items).toBeTruthy();
  });

  it('rejects a zero-quantity line, which would save and then deduct nothing', () => {
    expect(validateOrder(form({ lines: [line({ quantity: 0 })] }))['line.0.quantity']).toBeTruthy();
  });

  it('rejects a line with no product', () => {
    expect(validateOrder(form({ lines: [line({ productId: 0 })] }))['line.0.product']).toBeTruthy();
  });

  it('requires a status', () => {
    expect(validateOrder(form({ orderStatus: '' })).status).toBeTruthy();
  });

  it('summarises to the most useful message rather than the first key', () => {
    expect(errorSummary(validateOrder(form({ customerId: null })))).toContain('customer');
    expect(errorSummary(validateOrder(form({ lines: [] })))).toContain('item');
    expect(errorSummary(validateOrder(form({ lines: [line({ quantity: 0 })] })))).toBe(
      'Please fix the highlighted fields.',
    );
  });
});

describe('module config', () => {
  it('differs only in the label — the two modules are otherwise identical', () => {
    expect(PARLOUR_ORDER_CONFIG.moduleLabel).toBe('Parlour');
    expect(PHARMACY_ORDER_CONFIG.moduleLabel).toBe('Pharmacy');
    expect(PARLOUR_ORDER_CONFIG.extraFields).toEqual([]);
    expect(PHARMACY_ORDER_CONFIG.extraFields).toEqual([]);
  });

  it('resolves a module, defaulting to parlour for anything unexpected', () => {
    expect(configFor('PHARMACY')).toBe(PHARMACY_ORDER_CONFIG);
    expect(configFor('PARLOUR')).toBe(PARLOUR_ORDER_CONFIG);
  });
});
