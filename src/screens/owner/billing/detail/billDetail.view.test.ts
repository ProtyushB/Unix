import { toFormState, buildBillPayload, type BillFormState } from './billDetail.model';
import { newBareLine, toCustomProducts, toCustomServices } from './billLines';
import {
  alsoNeedsStatusPatch,
  appBarSubtitle,
  appBarTitle,
  billStatusLabel,
  billStatusOptions,
  contentKey,
  customerLocked,
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  paymentStatusLabel,
  saveLabel,
  saveRoute,
  showsDelete,
  showsEditCta,
  validateBill,
  type SaveShape,
} from './billDetail.view';

const READY = {
  mode: 'view' as const,
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
};

const base = (over: Partial<BillFormState> = {}): BillFormState => ({
  ...toFormState(null),
  customerId: 7,
  customerPhone: '900',
  billDate: '2026-08-05',
  lines: [newBareLine('PRODUCT', 77, 'Face Serum', 600, 2)],
  ...over,
});

describe('deriveDetailView', () => {
  it('matches the order and appointment screens exactly', () => {
    expect(deriveDetailView({ ...READY, saving: true, hasError: true, hasItem: false })).toBe(
      'SAVING',
    );
    expect(deriveDetailView({ ...READY, hasError: true, hasItem: false })).toBe('ERROR');
    expect(deriveDetailView({ ...READY, hasError: true, hasItem: true })).toBe('READY');
    expect(deriveDetailView({ ...READY, mode: 'add', loading: true, hasItem: false })).toBe(
      'READY',
    );
    expect(deriveDetailView({ ...READY, loading: true })).toBe('LOADING');
  });
});

describe('modes and copy', () => {
  it('gates by mode', () => {
    expect(isEditable('view')).toBe(false);
    expect(showsDelete('edit')).toBe(true);
    expect(showsDelete('add')).toBe(false);
    expect(showsEditCta('view')).toBe(true);
  });

  it('titles each mode', () => {
    expect(appBarTitle('add', '')).toBe('Create Bill');
    expect(appBarTitle('view', 'BILL-05082026-014')).toBe('BILL-05082026-014');
    expect(appBarSubtitle('add')).toBe('Select items and fill in details');
    expect(saveLabel('add')).toBe('Save');
  });

  it('labels both status axes', () => {
    expect(billStatusLabel('FINALIZED')).toBe('Finalized');
    expect(paymentStatusLabel('PARTIALLY_PAID')).toBe('Partially Paid');
    expect(paymentStatusLabel('PARTIAL_REFUNDED')).toBe('Partially Refunded');
  });
});

describe('billStatusOptions', () => {
  it('hides DRAFT once a bill is cancelled — the server 409s on that transition', () => {
    // Cancelling already released the items and returned the stock, so there is nothing coherent
    // to go back to. Offering it would only ever fail.
    expect(billStatusOptions('CANCELLED')).toEqual(['FINALIZED', 'CANCELLED']);
    expect(billStatusOptions('DRAFT')).toEqual(['DRAFT', 'FINALIZED', 'CANCELLED']);
  });
});

describe('customerLocked', () => {
  it('locks on attachment count, NOT on mode', () => {
    // The mockup draws Edit locked and Add unlocked, but the rule behind both is the same: a bill's
    // customer comes from what is on it. Add locks too, once something is attached.
    expect(customerLocked(0)).toBe(false);
    expect(customerLocked(1)).toBe(true);
  });
});

describe('saveRoute — which endpoint a save uses', () => {
  const shape = (over: Partial<SaveShape> = {}): SaveShape => ({
    billStatus: 'DRAFT',
    paymentStatus: 'UNPAID',
    paidAmount: 0,
    refundedAmount: 0,
    content: 'A',
    ...over,
  });

  it('PUTs a genuine content edit', () => {
    expect(saveRoute(shape(), shape({ content: 'B' }))).toBe('PUT');
  });

  it('PATCHes a payment change rather than folding it into a PUT', () => {
    // applySettlementAmounts rewrites paidAmount from the grandTotal the same request recomputed,
    // so a PUT cannot express "money changed" without the total moving under it.
    expect(saveRoute(shape(), shape({ paymentStatus: 'PAID' }))).toBe('PATCH_PAYMENT');
    expect(saveRoute(shape(), shape({ paidAmount: 4000 }))).toBe('PATCH_PAYMENT');
  });

  it('PATCHes a bill-status change, so CANCELLED cannot cascade through a content save', () => {
    // billStatus CANCELLED in a PUT body detaches every item and restocks every bare line.
    expect(saveRoute(shape(), shape({ billStatus: 'CANCELLED' }))).toBe('PATCH_STATUS');
    expect(saveRoute(shape(), shape({ billStatus: 'FINALIZED' }))).toBe('PATCH_STATUS');
  });

  it('prefers the payment PATCH when both statuses moved, and flags the second call', () => {
    const before = shape();
    const after = shape({ billStatus: 'FINALIZED', paymentStatus: 'PAID' });
    expect(saveRoute(before, after)).toBe('PATCH_PAYMENT');
    expect(alsoNeedsStatusPatch(before, after)).toBe(true);
  });

  it('does not ask for a second call when only one axis moved', () => {
    expect(alsoNeedsStatusPatch(shape(), shape({ billStatus: 'FINALIZED' }))).toBe(false);
    expect(alsoNeedsStatusPatch(shape(), shape({ content: 'B', billStatus: 'FINALIZED' }))).toBe(
      false,
    );
  });

  it('a content edit wins, because the statuses ride along in the same body', () => {
    expect(saveRoute(shape(), shape({ content: 'B', billStatus: 'FINALIZED' }))).toBe('PUT');
  });
});

describe('contentKey', () => {
  it('changes when the lines change', () => {
    const a = base();
    const b = base({ lines: [] });
    expect(contentKey(a)).not.toBe(contentKey(b));
  });

  it('changes when the money inputs change', () => {
    expect(contentKey(base())).not.toBe(contentKey(base({ tips: 100 })));
    expect(contentKey(base())).not.toBe(contentKey(base({ taxRate: 5 })));
  });

  it('does NOT change when only a status moves — that is the whole point', () => {
    expect(contentKey(base())).toBe(contentKey(base({ paymentStatus: 'PAID' })));
    expect(contentKey(base())).toBe(contentKey(base({ billStatus: 'FINALIZED' })));
    expect(contentKey(base())).toBe(contentKey(base({ paidAmount: 500 })));
  });
});

describe('validateBill', () => {
  it('passes a complete bill', () => {
    expect(hasErrors(validateBill(base()))).toBe(false);
  });

  it('requires the three fields the server @Valids', () => {
    expect(validateBill(base({ customerId: null })).customer).toBeTruthy();
    expect(validateBill(base({ customerPhone: '' })).customerPhone).toBeTruthy();
  });

  it('requires at least one item and a date', () => {
    expect(validateBill(base({ lines: [] })).items).toBeTruthy();
    expect(validateBill(base({ billDate: '' })).billDate).toBeTruthy();
  });

  it('requires a settlement amount for the two PARTIAL states', () => {
    // On PUT the server takes PARTIALLY_PAID with no amount as a clean 200 and derives nothing —
    // only the PATCH validates it. So this check is the only thing standing there.
    expect(validateBill(base({ paymentStatus: 'PARTIALLY_PAID' })).paidAmount).toBeTruthy();
    expect(
      validateBill(base({ paymentStatus: 'PARTIALLY_PAID', paidAmount: 4000 })).paidAmount,
    ).toBeUndefined();
    expect(validateBill(base({ paymentStatus: 'PARTIAL_REFUNDED' })).refundedAmount).toBeTruthy();
  });

  it('does not demand an amount for a status the server derives', () => {
    expect(hasErrors(validateBill(base({ paymentStatus: 'PAID' })))).toBe(false);
  });

  it('bounds the tax rate and a percentage discount', () => {
    expect(validateBill(base({ taxRate: 120 })).taxRate).toBeTruthy();
    expect(
      validateBill(base({ discount: { type: 'PERCENTAGE', value: 150 } })).discount,
    ).toBeTruthy();
  });

  it('summarises to the most useful message', () => {
    expect(errorSummary(validateBill(base({ customerId: null })))).toContain('customer');
    expect(errorSummary(validateBill(base({ lines: [] })))).toContain('item');
  });
});

/**
 * Regressions for what the independent contract check turned up. None of these were claims the
 * screen was built on — they are the traps it happens to avoid, pinned so a later edit cannot
 * wander into one.
 */
describe('server traps the payload must not walk into', () => {
  it('never sends a null discount value, which is an unguarded NPE and a 500', () => {
    // `discount: {type:'FIXED', value:null}` dereferences straight into a catch-all 500 rather than
    // a validation error, so the value is coerced and a zero drops the key entirely.
    const p = buildBillPayload(
      base({ discount: { type: 'FIXED', value: NaN as unknown as number } }),
      3,
    );
    expect(p.discount).toBeUndefined();
  });

  it('never sends a null service quantity, which is an unboxing NPE and a 500', () => {
    // Asymmetric with products, which the server defaults to 1. Services do not.
    expect(toCustomServices([{ refId: 21 }])[0].quantity).toBe(1);
    expect(toCustomServices([{ refId: 21, quantity: null }])[0].quantity).toBe(1);
  });

  it('only ever emits a discount type the server recognises', () => {
    // An unrecognised type is STORED but never applied, so the response shows a discount that did
    // not change the total. Only the two literals can reach the wire.
    const p = buildBillPayload(base({ discount: { type: 'PERCENTAGE', value: 5 } }), 3);
    expect((p.discount as { type: string }).type).toBe('PERCENTAGE');
  });

  it('rebuilds customProducts ONLY from bare lines, never from an order-backed one', () => {
    // The double-deduction trap. An order-required product quick-added on a previous save now
    // lives in the AUTO-GENERATED order, not in bareProducts — so it comes back as an ORDER line
    // and rides `billedOrders`. Re-sending it in customProducts would build a SECOND auto-generated
    // order with a SECOND inventory deduction, and the first is released but never restocked.
    // N saves would mean N deductions and N-1 orphan orders.
    const lines = [
      { kind: 'ORDER' as const, refId: 94, label: 'ORD-1', sublabel: '', amount: 626 },
      newBareLine('PRODUCT', 77, 'Face Serum', 600, 2),
    ];
    const p = buildBillPayload(base({ lines }), 3);
    expect((p.customProducts as unknown[]).length).toBe(1);
    expect((p.customProducts as { productId: number }[])[0].productId).toBe(77);
    expect(p.billedOrders).toEqual([94]);
  });

  it('sends no read-side field name, which would drop attribution with no error', () => {
    // BareBillLineDto has refId/personId; CreateBillRequest wants productId/salesPersonId. There is
    // no productId on the read side at all, so a straight echo silently loses both.
    const [p] = toCustomProducts([{ refId: 77, personId: 2, quantity: 1 }]);
    expect(p).not.toHaveProperty('refId');
    expect(p).not.toHaveProperty('personId');
    expect(p.productId).toBe(77);
    expect(p.salesPersonId).toBe(2);
  });
});
