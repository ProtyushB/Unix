import {
  balanceOf,
  computeBillMoney,
  discountAmount,
  discountLabel,
  readDiscount,
  settlementField,
  showsSettlementInput,
  writeDiscount,
  type Discount,
} from './billMoney';

const FIXED = (value: number): Discount => ({ type: 'FIXED', value });
const PCT = (value: number): Discount => ({ type: 'PERCENTAGE', value });

describe('discountAmount', () => {
  it('takes a fixed discount at face value', () => {
    expect(discountAmount(1000, FIXED(200))).toBe(200);
  });

  it('takes a percentage off the subtotal', () => {
    expect(discountAmount(6826, PCT(5))).toBeCloseTo(341.3);
  });

  it('clamps a fixed discount to the subtotal, or the total goes negative', () => {
    expect(discountAmount(500, FIXED(900))).toBe(500);
  });

  it('clamps a percentage over 100, which would go negative by a different route', () => {
    expect(discountAmount(500, PCT(150))).toBe(500);
  });

  it('treats a negative or unparseable discount as none', () => {
    expect(discountAmount(500, FIXED(-50))).toBe(0);
    expect(discountAmount(500, { type: 'FIXED', value: NaN })).toBe(0);
  });
});

describe('computeBillMoney', () => {
  // The mockup's worked example: 6,826 subtotal, 200 tips, 5% off, 18% tax → 7,852.
  const drawn = { subtotal: 6826, tips: 200, discount: PCT(5), taxRate: 18 };

  it('reproduces the figures the mockup draws', () => {
    const m = computeBillMoney(drawn);
    expect(Math.round(m.discountAmount)).toBe(341);
    expect(Math.round(m.taxAmount)).toBe(1167);
    expect(Math.round(m.grandTotal)).toBe(7852);
  });

  it('taxes AFTER the discount, not before', () => {
    // Taxing the gross would give 6826 × 0.18 = 1228.68 rather than 1167.
    const m = computeBillMoney(drawn);
    expect(m.taxAmount).toBeCloseTo(m.afterDiscount * 0.18);
  });

  it('adds tips AFTER tax — a tip is not taxable', () => {
    // Swapping the two lines changes the total by tax × tips with nothing visible changing.
    const withTip = computeBillMoney(drawn);
    const withoutTip = computeBillMoney({ ...drawn, tips: 0 });
    expect(withTip.grandTotal - withoutTip.grandTotal).toBeCloseTo(200);
  });

  it('handles a bill with nothing on it', () => {
    const m = computeBillMoney({ subtotal: 0, tips: 0, discount: FIXED(0), taxRate: 0 });
    expect(m.grandTotal).toBe(0);
  });

  it('never returns a negative total, however hostile the inputs', () => {
    const m = computeBillMoney({ subtotal: 100, tips: 0, discount: FIXED(9999), taxRate: 18 });
    expect(m.grandTotal).toBe(0);
    expect(m.discountAmount).toBe(100);
  });

  it('clamps a tax rate above 100 and ignores a negative one', () => {
    expect(
      computeBillMoney({ subtotal: 100, tips: 0, discount: FIXED(0), taxRate: 200 }).taxAmount,
    ).toBe(100);
    expect(
      computeBillMoney({ subtotal: 100, tips: 0, discount: FIXED(0), taxRate: -5 }).taxAmount,
    ).toBe(0);
  });
});

describe('balanceOf', () => {
  it('is what is still owed', () => {
    expect(balanceOf(7852, 4000)).toBe(3852);
  });

  it('never goes negative — an overpayment is a refund question, not a balance', () => {
    expect(balanceOf(1000, 1500)).toBe(0);
  });
});

describe('discount labels and round trip', () => {
  it('names the percentage in the label, as the mockup draws it', () => {
    expect(discountLabel(PCT(5))).toBe('Discount (5%)');
    expect(discountLabel(FIXED(200))).toBe('Discount');
    expect(discountLabel(PCT(0))).toBe('Discount');
  });

  it('reads a stored discount, normalising the case the server uses', () => {
    expect(readDiscount({ type: 'PERCENTAGE', value: 5 })).toEqual({
      type: 'PERCENTAGE',
      value: 5,
    });
    expect(readDiscount({ type: 'percentage', value: 5 }).type).toBe('PERCENTAGE');
    expect(readDiscount({ type: 'fixed', value: 200 })).toEqual({ type: 'FIXED', value: 200 });
  });

  it('reads a null discount as none — the column is nullable jsonb', () => {
    expect(readDiscount(null)).toEqual({ type: 'FIXED', value: 0 });
    expect(readDiscount(undefined)).toEqual({ type: 'FIXED', value: 0 });
  });

  it('writes undefined for a zero discount, so the key drops and the server clears it', () => {
    // Sending {type:'FIXED', value:0} would store a meaningless zero discount instead of none.
    expect(writeDiscount(FIXED(0))).toBeUndefined();
    expect(writeDiscount(PCT(0))).toBeUndefined();
    expect(writeDiscount(PCT(5))).toEqual({ type: 'PERCENTAGE', value: 5 });
  });
});

describe('settlement', () => {
  it('accepts a client amount only for the two PARTIAL states', () => {
    // Everything else is overwritten by applySettlementAmounts on every write.
    expect(settlementField('PARTIALLY_PAID')).toBe('paidAmount');
    expect(settlementField('PARTIAL_REFUNDED')).toBe('refundedAmount');
    expect(settlementField('PAID')).toBeNull();
    expect(settlementField('REFUNDED')).toBeNull();
    expect(settlementField('UNPAID')).toBeNull();
    expect(settlementField('FAILED')).toBeNull();
  });

  it('shows the input exactly when the server will read it', () => {
    expect(showsSettlementInput('PARTIALLY_PAID')).toBe(true);
    expect(showsSettlementInput('PAID')).toBe(false);
  });
});
