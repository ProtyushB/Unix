import { toFormState, buildBillPayload, type BillFormState } from './billDetail.model';
import {
  newBareLine,
  newQuickLine,
  toCustomProducts,
  toCustomServices,
  type BillLine,
} from './billLines';
import type { QuickBillItem } from './quickItem';
import {
  acceptsFormSeed,
  alsoNeedsStatusPatch,
  appBarSubtitle,
  appBarTitle,
  billDateBounds,
  billDatePickerDay,
  billStatusLabel,
  billStatusOptions,
  contentKey,
  customerLocked,
  deriveDetailView,
  errorSummary,
  hasErrors,
  hasUnsavedChanges,
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

describe('acceptsFormSeed — when the bill may be poured back into the form', () => {
  it('refuses while the user is editing a bill the form already holds', () => {
    // The one that matters. The screen hands the form hook a new `item` object mid-save — the bill
    // the payment PATCH just committed — with the edit form on screen and a status pick in it that
    // has not been sent yet. Saying yes here rewrites that pick back to the server's value, and the
    // toast that follows says the status was not saved, as though the pick were still there to
    // retry with.
    expect(acceptsFormSeed('edit', true)).toBe(false);
  });

  it('still fills an edit form that holds nothing yet', () => {
    // Opening straight into edit mode from a deep link: the bill arrives after the form is mounted,
    // and this is the arrival that fills it. Refusing here would leave the user editing a blank
    // bill — there is no work to lose before the first fill, only work to be given.
    expect(acceptsFormSeed('edit', false)).toBe(true);
  });

  it('takes every copy of the bill while the form is read-only', () => {
    // In view mode the form IS the rendering of the bill — nothing on screen can write to it — so a
    // fresher bill is only ever an improvement. This is what puts a committed payment back on
    // screen when the user taps back out of a half-saved edit, and what lets the refetch that
    // follows correct the form if `item` was behind.
    expect(acceptsFormSeed('view', true)).toBe(true);
    expect(acceptsFormSeed('view', false)).toBe(true);
  });

  it('never fills an add, which has no bill behind it', () => {
    expect(acceptsFormSeed('add', false)).toBe(false);
    expect(acceptsFormSeed('add', true)).toBe(false);
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

  it('the committed half of that save reaches the screen without reaching the form', () => {
    // The whole sequence, in the pieces that are decidable without React. A cancelled unpaid bill
    // is edited to partially paid / ₹500 / finalized: the payment goes first as its own PATCH and
    // commits, and the status PATCH after it is refused.
    const fetched = shape({ billStatus: 'CANCELLED', paymentStatus: 'UNPAID' });
    const edited = shape({
      billStatus: 'FINALIZED',
      paymentStatus: 'PARTIALLY_PAID',
      paidAmount: 500,
    });
    expect(saveRoute(fetched, edited)).toBe('PATCH_PAYMENT');
    expect(alsoNeedsStatusPatch(fetched, edited)).toBe(true);

    // The committed bill is handed to the screen mid-save, so `item` stops being the pre-payment
    // one — but the mode is still 'edit' and the form still holds FINALIZED, which the user has to
    // be able to retry with. Nothing may be poured over it.
    expect(acceptsFormSeed('edit', true)).toBe(false);

    // Only when the user leaves the edit screen does the bill go back into the form, and by then it
    // is the one carrying the payment that committed.
    expect(acceptsFormSeed('view', true)).toBe(true);
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

  it('sends NOTHING when nothing moved, rather than a PUT with an identical body', () => {
    // This answered 'PUT' — "the user pressed Save and expects something to happen, and with no
    // content change there is nothing for it to damage". There is: the server drops every bare
    // line, restocks its batch ledger, rebuilds the line from the LIVE catalog row and deducts
    // again. An issued bill re-totals at today's prices, the FEFO round trip need not return the
    // batches it took, and the app reports success.
    expect(saveRoute(shape(), shape())).toBe('NO_CHANGE');
    expect(alsoNeedsStatusPatch(shape(), shape())).toBe(false);
  });
});

describe('hasUnsavedChanges — the predicate the Save control reads', () => {
  const asShape = (f: BillFormState): SaveShape => ({
    billStatus: f.billStatus,
    paymentStatus: f.paymentStatus,
    paidAmount: f.paidAmount,
    refundedAmount: f.refundedAmount,
    content: contentKey(f),
  });

  it('is false for a bill nobody has touched, which is what greys out Save', () => {
    expect(hasUnsavedChanges(asShape(base()), asShape(base()))).toBe(false);
  });

  it('is true when only the bill date moved — a back-date is a real edit, not a no-op', () => {
    // The half of this that would break the feature: gate the button on this predicate, have it
    // miss the date, and the picker becomes unusable.
    expect(hasUnsavedChanges(asShape(base()), asShape(base({ billDate: '2026-07-15' })))).toBe(
      true,
    );
  });

  it('is true for every other axis the form can move', () => {
    expect(hasUnsavedChanges(asShape(base()), asShape(base({ billStatus: 'FINALIZED' })))).toBe(
      true,
    );
    expect(hasUnsavedChanges(asShape(base()), asShape(base({ paymentStatus: 'PAID' })))).toBe(true);
    expect(hasUnsavedChanges(asShape(base()), asShape(base({ notes: 'called ahead' })))).toBe(true);
    expect(hasUnsavedChanges(asShape(base()), asShape(base({ lines: [] })))).toBe(true);
  });

  it('is true with no baseline, so a create is never gated shut', () => {
    // A form with no saved bill behind it — an add, or an edit whose fetch has not landed. There
    // is nothing to be unchanged from.
    expect(hasUnsavedChanges(null, asShape(base()))).toBe(true);
  });
});

describe('a date-only edit — where the two fixes have to agree', () => {
  const asShape = (f: BillFormState): SaveShape => ({
    billStatus: f.billStatus,
    paymentStatus: f.paymentStatus,
    paidAmount: f.paidAmount,
    refundedAmount: f.refundedAmount,
    content: contentKey(f),
  });

  it('still reaches the server, and now says which day', () => {
    // Blocking the no-change save and sending the date landed together, and this is the case where
    // getting it wrong makes the date unsavable. `contentKey` hashes `billDate`, so a re-date is a
    // content change and earns the PUT — the same route it took before.
    const fetched = base();
    const backDated = base({ billDate: '2026-07-15' });
    expect(saveRoute(asShape(fetched), asShape(backDated))).toBe('PUT');

    const body = buildBillPayload(backDated, 3);
    expect(body.billDate).toBe('2026-07-15');

    // What used to happen instead: the re-date produced a body byte-identical to the untouched
    // bill's, so the app called its most destructive endpoint to carry nothing at all.
    expect(JSON.stringify(body)).not.toBe(JSON.stringify(buildBillPayload(fetched, 3)));
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

  it('saves a counter sale — no customer, and therefore no phone', () => {
    // Both annotations came off CreateBillRequest with V121. The phone is the half that hides: a
    // customerless bill's phone is '', so a lingering check there would keep refusing the bill long
    // after the customer check went, complaining about a customer that is not there.
    expect(hasErrors(validateBill(base({ customerId: null, customerPhone: '' })))).toBe(false);
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

  it('refuses a date after today, and takes today itself', () => {
    // The picker cannot offer one any more, so this is the floor under any path around it.
    expect(validateBill(base({ billDate: '2026-08-07' }), '2026-08-06').billDate).toBeTruthy();
    expect(validateBill(base({ billDate: '2026-08-06' }), '2026-08-06').billDate).toBeUndefined();
  });

  it('still saves a bill older than the picker floor', () => {
    // Deliberately not symmetrical with the picker. `validateBill` runs before the save picks a
    // route, and a payment or status PATCH sends no date at all — so refusing here would block
    // marking a 2024 bill PAID over a date the user never chose and is not sending.
    expect(validateBill(base({ billDate: '2024-06-01' }), '2026-08-06').billDate).toBeUndefined();
  });

  it('summarises to the most useful message', () => {
    expect(errorSummary(validateBill(base({ lines: [] })))).toContain('item');
  });
});

describe('billDateBounds — the days the picker may offer', () => {
  // 02:00 IST on the 6th. Chosen because its UTC day and its IST day are different days, so a
  // device-zone reading of "today" answers '2026-08-05' here and an IST one answers '2026-08-06'.
  const IST_SMALL_HOURS = new Date('2026-08-05T20:30:00Z');

  /** Pins the clock the default arguments read, so "today" is a fact of the test, not the machine. */
  const atInstant = <T>(instant: Date, fn: () => T): T => {
    jest.useFakeTimers({ now: instant });
    try {
      return fn();
    } finally {
      jest.useRealTimers();
    }
  };

  /**
   * `GenericBillService#validateBillDate`, transcribed — refuse anything after today, refuse
   * anything before 1 January of last year. Written out in date arithmetic rather than by calling
   * `billDateBounds`, so "the picker and the server agree" is a claim about two independent
   * derivations rather than a tautology.
   */
  const serverAccepts = (ymd: string, today: string): boolean => {
    const day = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    const floor = Date.UTC(Number(today.slice(0, 4)) - 1, 0, 1);
    return day(ymd) <= day(today) && day(ymd) >= floor;
  };

  const dayAfter = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  };
  const dayBefore = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  };

  it('maxes out at today in IST, and floors at 1 January of last year', () => {
    expect(atInstant(IST_SMALL_HOURS, () => billDateBounds())).toEqual({
      min: '2025-01-01',
      max: '2026-08-06',
    });
  });

  it('names the same day the create seed does', () => {
    // The bound and the default date are the same question asked twice. If they answer differently
    // the form opens on a day its own picker refuses to show.
    const [max, seeded] = atInstant(IST_SMALL_HOURS, () => [
      billDateBounds().max,
      toFormState(null).billDate,
    ]);
    expect(max).toBe(seeded);
  });

  it('draws its edges exactly where the server draws them', () => {
    for (const today of ['2026-08-06', '2027-01-01', '2026-12-31']) {
      const { min, max } = billDateBounds(today);
      expect(serverAccepts(max, today)).toBe(true);
      expect(serverAccepts(dayAfter(max), today)).toBe(false);
      expect(serverAccepts(min, today)).toBe(true);
      expect(serverAccepts(dayBefore(min), today)).toBe(false);
    }
  });

  it('follows the calendar year over into January', () => {
    // The floor is the YEAR's, not a rolling window: on 1 January it steps back a whole year, which
    // is what keeps back-dating to 31 December possible on the 1st.
    expect(billDateBounds('2026-12-31').min).toBe('2025-01-01');
    expect(billDateBounds('2027-01-01').min).toBe('2026-01-01');
  });
});

describe('billDatePickerDay — where the dialog opens', () => {
  const bounds = billDateBounds('2026-08-06');

  it("opens on the bill's own date when the window allows it", () => {
    expect(billDatePickerDay('2026-07-15', bounds)).toBe('2026-07-15');
    expect(billDatePickerDay('2026-08-06', bounds)).toBe('2026-08-06');
  });

  it('opens on the nearest offerable day for a bill older than the floor', () => {
    // A 2024 bill is still editable, and its own date is a day the picker may no longer show.
    expect(billDatePickerDay('2024-06-01', bounds)).toBe('2025-01-01');
    expect(billDatePickerDay('2026-09-01', bounds)).toBe('2026-08-06');
  });

  it('falls back to today IST, not to the device day, when the form has no date', () => {
    expect(billDatePickerDay('', bounds)).toBe('2026-08-06');
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

describe('contentKey with quick items', () => {
  const quick = (over: Partial<QuickBillItem> = {}): BillLine =>
    newQuickLine({
      lineId: 'q-1',
      name: 'Imported Clay Mask',
      price: 450,
      quantity: 2,
      unit: 'jar',
      discount: 0,
      dmsFolderId: null,
      photos: [],
      photo: null,
      ...over,
    });

  it('changes when a quick item is added', () => {
    expect(contentKey(base())).not.toBe(contentKey(base({ lines: [quick()] })));
  });

  it('changes when one quick item is swapped for another of the same count', () => {
    // Every quick line carries refId 0, so a key built from [kind, refId] alone cannot tell these
    // apart — and an unchanged key routes a payment-and-content save to PATCH_PAYMENT, which
    // silently drops the swap.
    const a = base({ lines: [quick()] });
    const b = base({ lines: [quick({ lineId: 'q-2', name: 'Handmade Soy Candle', price: 600 })] });
    expect(contentKey(a)).not.toBe(contentKey(b));

    // And the routing consequence, which is the part that actually loses data: with the payment
    // also moved, an unchanged content key sends this through PATCH_PAYMENT and the swap is never
    // written.
    const asShape = (f: BillFormState, over: Partial<SaveShape> = {}): SaveShape => ({
      billStatus: f.billStatus,
      paymentStatus: f.paymentStatus,
      paidAmount: f.paidAmount,
      refundedAmount: f.refundedAmount,
      content: contentKey(f),
      ...over,
    });
    expect(saveRoute(asShape(a), asShape(b, { paymentStatus: 'PAID' }))).toBe('PUT');
  });

  it('changes when only the price, quantity or unit of a quick item moves', () => {
    const a = base({ lines: [quick()] });
    expect(contentKey(a)).not.toBe(contentKey(base({ lines: [quick({ price: 500 })] })));
    expect(contentKey(a)).not.toBe(contentKey(base({ lines: [quick({ quantity: 3 })] })));
    expect(contentKey(a)).not.toBe(contentKey(base({ lines: [quick({ unit: 'tub' })] })));
  });

  it('changes when a photo is staged on an otherwise untouched quick item', () => {
    const photo = { uri: 'file:///mask.jpg', name: 'mask.jpg', type: 'image/jpeg' };
    expect(contentKey(base({ lines: [quick()] }))).not.toBe(
      contentKey(base({ lines: [quick({ photo })] })),
    );
  });

  it('still ignores a status move on a bill that has quick items', () => {
    const withQuick = { lines: [quick()] };
    expect(contentKey(base(withQuick))).toBe(
      contentKey(base({ ...withQuick, paymentStatus: 'PAID' })),
    );
  });
});
