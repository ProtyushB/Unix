import {
  attachedCount,
  billDateOf,
  buildBillPayload,
  formatBillDate,
  formatStamp,
  itemCountLabel,
  money,
  toFormState,
  type BillDetailItem,
  type BillFormState,
} from './billDetail.model';
import type { BillLine } from './billLines';

/** A fetched bill with all three line kinds, money, and both status axes set. */
function serverBill(): BillDetailItem {
  return {
    id: 52,
    businessId: 3,
    billNumber: 'BILL-05082026-014',
    customerId: 7,
    customerName: 'Anjali Rao',
    customerPhone: '+91 90000 12345',
    customerEmail: 'anjali@mail.com',
    billDate: '2026-08-05T13:10:00Z',
    billStatus: 'FINALIZED',
    paymentStatus: 'PAID',
    paymentOption: 'EMI',
    notes: 'Paid in full at the counter — card payment.',
    subtotal: 6826,
    tips: 200,
    discount: { type: 'PERCENTAGE', value: 5 },
    discountAmount: 341.3,
    taxRate: 18,
    taxAmount: 1167.25,
    grandTotal: 7852,
    paidAmount: 7852,
    refundedAmount: 0,
    createdAt: '2026-08-05T13:10:00Z',
    updatedAt: '2026-08-05T13:12:00Z',
    billedOrderDetails: [
      { id: 94, orderNumber: 'ORD-05082026-042', orderDate: '2026-08-05', totalAmount: 626 },
    ],
    billedAppointmentDetails: [
      {
        id: 12,
        appointmentNumber: 'APT-05082026-001',
        appointmentDate: '2026-08-05',
        totalAmount: 5000,
      },
    ],
    bareProducts: [
      {
        refId: 77,
        name: 'Face Serum',
        quantity: 2,
        itemPrice: 600,
        totalPrice: 1200,
        discount: 0,
        personId: 2,
        sellingUnit: 'bottle',
        unitMultiplier: 1,
      },
    ],
    bareServices: [],
  };
}

const form = (over: Partial<BillFormState> = {}): BillFormState => ({
  ...toFormState(serverBill()),
  ...over,
});

describe('toFormState', () => {
  it('reads both status axes independently', () => {
    // FINALIZED and PAID here, but FINALIZED + UNPAID is a real state — a delivered order awaiting
    // payment — which is why they are two fields and not one.
    const f = toFormState(serverBill());
    expect(f.billStatus).toBe('FINALIZED');
    expect(f.paymentStatus).toBe('PAID');
  });

  it('preserves paymentOption, so a phone with no EMI screen cannot downgrade an EMI bill', () => {
    expect(toFormState(serverBill()).paymentOption).toBe('EMI');
    expect(toFormState(null).paymentOption).toBe('NORMAL');
  });

  it('reads the money inputs, not the computed figures', () => {
    const f = toFormState(serverBill());
    expect(f.tips).toBe(200);
    expect(f.discount).toEqual({ type: 'PERCENTAGE', value: 5 });
    expect(f.taxRate).toBe(18);
  });

  it('defaults a NEW bill to 18% tax but leaves an existing zero alone', () => {
    // The drawn default is for creation. An existing bill deliberately taxed at 0 must stay at 0.
    expect(toFormState(null).taxRate).toBe(18);
    expect(toFormState({ ...serverBill(), taxRate: 0 }).taxRate).toBe(0);
  });

  it('converts billDate through IST rather than slicing the ISO string', () => {
    // Slicing gives the UTC day, i.e. the previous one before 05:30 IST.
    expect(billDateOf({ billDate: '2026-08-05T20:30:00Z' })).toBe('2026-08-06');
    expect(billDateOf({ billDate: '2026-08-05' })).toBe('2026-08-05');
    expect(billDateOf(null)).toBe('');
  });

  it('reads all three line kinds', () => {
    expect(toFormState(serverBill()).lines.map((l) => l.kind)).toEqual([
      'ORDER',
      'APPOINTMENT',
      'PRODUCT',
    ]);
  });
});

describe('buildBillPayload — one test per erasable field', () => {
  it('sends billedOrders, or every linked order is RELEASED', () => {
    // Not "the bill forgets them": isBilled goes false and billId null, so they reappear in the
    // billable picker while the bill still shows their money.
    expect(buildBillPayload(form(), 3).billedOrders).toEqual([94]);
  });

  it('sends billedAppointments for the same reason', () => {
    expect(buildBillPayload(form(), 3).billedAppointments).toEqual([12]);
  });

  it('sends customProducts, or the bare lines are deleted AND their stock is RESTOCKED', () => {
    // The single most expensive omission on this screen: it returns inventory that was sold.
    expect(buildBillPayload(form(), 3).customProducts).toEqual([
      {
        productId: 77,
        salesPersonId: 2,
        quantity: 2,
        discount: 0,
        sellingUnit: 'bottle',
        unitMultiplier: 1,
        unitLines: null,
      },
    ]);
  });

  it('sends customServices even when empty, rather than omitting the key', () => {
    // An empty array and a missing key are the same to this endpoint, but sending it keeps the
    // payload honest about what the bill holds.
    expect(buildBillPayload(form(), 3).customServices).toEqual([]);
  });

  it('sends notes, or the stored note is erased', () => {
    expect(buildBillPayload(form(), 3).notes).toBe('Paid in full at the counter — card payment.');
    expect(buildBillPayload(form({ notes: '' }), 3).notes).toBe('');
  });

  it('sends tips, or it is forced to zero', () => {
    expect(buildBillPayload(form(), 3).tips).toBe(200);
  });

  it('sends taxRate, or it and the tax amount are zeroed', () => {
    expect(buildBillPayload(form(), 3).taxRate).toBe(18);
  });

  it('sends the discount as {type, value} with an UPPER-CASE type', () => {
    expect(buildBillPayload(form(), 3).discount).toEqual({ type: 'PERCENTAGE', value: 5 });
  });

  it('drops the discount key when there is none, which is how a removal is expressed', () => {
    const p = buildBillPayload(form({ discount: { type: 'FIXED', value: 0 } }), 3);
    expect(p.discount).toBeUndefined();
  });

  it('sends the three @NotNull fields', () => {
    const p = buildBillPayload(form(), 3);
    expect(p.customerId).toBe(7);
    expect(p.customerPhone).toBe('+91 90000 12345');
    expect(p.businessId).toBe(3);
  });

  it('echoes paymentOption, so an EMI bill is not silently converted to NORMAL', () => {
    expect(buildBillPayload(form(), 3).paymentOption).toBe('EMI');
  });
});

describe('buildBillPayload — what must NOT be sent', () => {
  it('sends no computed total: the server owns all four and the request has no field for them', () => {
    const p = buildBillPayload(form(), 3);
    expect(p).not.toHaveProperty('subtotal');
    expect(p).not.toHaveProperty('discountAmount');
    expect(p).not.toHaveProperty('taxAmount');
    expect(p).not.toHaveProperty('grandTotal');
  });

  it('sends no bill id or number in the body — the id travels in the PATH', () => {
    const p = buildBillPayload(form(), 3);
    expect(p).not.toHaveProperty('id');
    expect(p).not.toHaveProperty('billNumber');
  });

  it('sends no settlement amount for a status the server overwrites anyway', () => {
    // On PAID, applySettlementAmounts sets paidAmount = grandTotal whatever the client sent.
    const p = buildBillPayload(form({ paymentStatus: 'PAID' }), 3);
    expect(p).not.toHaveProperty('paidAmount');
    expect(p).not.toHaveProperty('refundedAmount');

    for (const status of ['UNPAID', 'FAILED', 'REFUNDED']) {
      const q = buildBillPayload(form({ paymentStatus: status }), 3);
      expect(q).not.toHaveProperty('paidAmount');
      expect(q).not.toHaveProperty('refundedAmount');
    }
  });

  it('sends paidAmount ONLY for PARTIALLY_PAID, where omitting it is a 400', () => {
    const p = buildBillPayload(form({ paymentStatus: 'PARTIALLY_PAID', paidAmount: 4000 }), 3);
    expect(p.paidAmount).toBe(4000);
    expect(p).not.toHaveProperty('refundedAmount');
  });

  it('sends refundedAmount ONLY for PARTIAL_REFUNDED', () => {
    const p = buildBillPayload(form({ paymentStatus: 'PARTIAL_REFUNDED', refundedAmount: 500 }), 3);
    expect(p.refundedAmount).toBe(500);
    expect(p).not.toHaveProperty('paidAmount');
  });
});

describe('buildBillPayload — clamping', () => {
  it('never sends a negative tip or an out-of-range tax rate', () => {
    expect(buildBillPayload(form({ tips: -50 }), 3).tips).toBe(0);
    expect(buildBillPayload(form({ taxRate: 250 }), 3).taxRate).toBe(100);
    expect(buildBillPayload(form({ taxRate: -1 }), 3).taxRate).toBe(0);
  });

  it('trims the phone, which is @NotBlank rather than @NotNull', () => {
    expect(buildBillPayload(form({ customerPhone: '  900  ' }), 3).customerPhone).toBe('900');
  });
});

describe('money', () => {
  it('reproduces the drawn summary from the lines on screen', () => {
    // 626 + 5000 + 1200 = 6826 subtotal, then 5% off, 18% tax, +200 tips.
    const m = money(form());
    expect(m.subtotal).toBe(6826);
    expect(Math.round(m.grandTotal)).toBe(7852);
  });

  it('follows the lines rather than the stored figures when one is removed', () => {
    const lines = form().lines.filter((l) => l.kind !== 'APPOINTMENT');
    expect(money(form({ lines })).subtotal).toBe(1826);
  });
});

describe('read-mode helpers', () => {
  it('counts the items and the attached records separately', () => {
    const f = form();
    expect(itemCountLabel(f.lines)).toBe('3 items');
    // Only orders and appointments lock the customer; a bare line does not.
    expect(attachedCount(f.lines)).toBe(2);
    expect(attachedCount(f.lines.filter((l) => l.kind === 'PRODUCT'))).toBe(0);
    expect(itemCountLabel([{} as BillLine])).toBe('1 item');
  });

  it('formats the dates from parts', () => {
    expect(formatBillDate('2026-08-05')).toBe('5 Aug 2026');
    expect(formatBillDate('')).toBe('');
    expect(formatStamp('2026-08-05T13:10:00Z')).toContain('Aug 2026');
    expect(formatStamp(null)).toBe('');
  });
});
