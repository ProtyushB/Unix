import {
  addUnit,
  baseSaleUnit,
  displayUnitLines,
  isMixedLine,
  lineBaseQty,
  lineEffUnitPrice,
  lineTotal,
  mixedLabel,
  removeUnit,
  rollUpMixed,
  saleUnitsOf,
  selectUnit,
  unitSummary,
  updateUnitQty,
  type OrderLine,
} from './orderLineUnits';

const STRIP = { unit: 'strip', perStock: 10, price: 28 };
const TABLET = { unit: 'tablet', perStock: 1, price: 6 };
const BOX = { unit: 'box', perStock: 100, price: 250 };

/** The mockup's Paracetamol row: 1 strip at ₹28 and 4 tablets at ₹6. */
function mixed(): OrderLine {
  return {
    productId: 5,
    quantity: 14,
    sellingUnit: null,
    unitMultiplier: 1,
    itemPrice: 52 / 14,
    totalPrice: 52,
    discount: 0,
    unitLines: [
      { ...STRIP, qty: 1 },
      { ...TABLET, qty: 4 },
    ],
  };
}

function single(): OrderLine {
  return {
    productId: 9,
    quantity: 2,
    sellingUnit: 'strip',
    unitMultiplier: 10,
    itemPrice: 28,
    totalPrice: 56,
    discount: 0,
  };
}

describe('isMixedLine', () => {
  it('needs more than one unit — a one-entry breakdown is still a plain line', () => {
    // Treating it as mixed would blank its sellingUnit on the next save, for no reason.
    expect(isMixedLine({ unitLines: [{ ...STRIP, qty: 1 }] })).toBe(false);
    expect(isMixedLine(mixed())).toBe(true);
    expect(isMixedLine({ unitLines: null })).toBe(false);
    expect(isMixedLine({})).toBe(false);
  });
});

describe('displayUnitLines', () => {
  it('synthesises one row from a single-unit line, so the UI has one shape to render', () => {
    expect(displayUnitLines(single())).toEqual([
      { unit: 'strip', perStock: 10, qty: 2, price: 28 },
    ]);
  });

  it('returns the stored breakdown for a mixed line', () => {
    expect(displayUnitLines(mixed())).toHaveLength(2);
  });

  it('is empty for a line with neither, which is a freshly picked row awaiting a unit', () => {
    expect(
      displayUnitLines({ productId: 1, quantity: 0, itemPrice: 0, totalPrice: 0, discount: 0 }),
    ).toEqual([]);
  });
});

describe('quantities and money', () => {
  it('counts a mixed line in BASE units, which is what stock is deducted in', () => {
    // 1 strip × 10 + 4 tablets × 1 = 14 base units. Getting this wrong deducts the wrong stock.
    expect(lineBaseQty(mixed())).toBe(14);
  });

  it('counts a single-unit line through its multiplier', () => {
    expect(lineBaseQty(single())).toBe(20);
  });

  it('totals a mixed line per unit, because each rung has its own price', () => {
    // 1 × 28 + 4 × 6 = 52. Not 14 × any single price.
    expect(lineTotal(mixed())).toBe(52);
    expect(lineTotal(single())).toBe(56);
  });

  it('blends the base unit price so quantity × itemPrice reproduces the total', () => {
    const line = mixed();
    expect(lineEffUnitPrice(line)).toBeCloseTo(52 / 14);
    expect(lineBaseQty(line) * lineEffUnitPrice(line)).toBeCloseTo(lineTotal(line));
  });

  it('does not divide by zero on an empty line', () => {
    expect(
      lineEffUnitPrice({ productId: 1, quantity: 0, itemPrice: 0, totalPrice: 0, discount: 0 }),
    ).toBe(0);
  });
});

describe('rollUpMixed', () => {
  it('flattens to base units, drops the selling unit and resets the multiplier', () => {
    // All three together: quantity is already in base units, so leaving unitMultiplier at 10 would
    // deduct ten times the stock, and naming one sellingUnit would be a lie about the other.
    const out = rollUpMixed(single(), [
      { ...STRIP, qty: 1 },
      { ...TABLET, qty: 4 },
    ]);
    expect(out.quantity).toBe(14);
    expect(out.sellingUnit).toBeNull();
    expect(out.unitMultiplier).toBe(1);
    expect(out.totalPrice).toBe(52);
    expect(out.itemPrice).toBeCloseTo(52 / 14);
  });

  it('keeps unitLines, or the breakdown is lost and cannot be read back', () => {
    const out = rollUpMixed(single(), [
      { ...STRIP, qty: 1 },
      { ...TABLET, qty: 4 },
    ]);
    expect(out.unitLines).toEqual([
      { ...STRIP, qty: 1 },
      { ...TABLET, qty: 4 },
    ]);
    expect(isMixedLine(out)).toBe(true);
  });

  it('collapses back to a PLAIN line when only one unit survives', () => {
    // Not a mixed line of size one: removing a rung must leave a normal row, with its real unit
    // and real price, not a null sellingUnit the server then stores.
    const out = rollUpMixed(mixed(), [{ ...STRIP, qty: 3 }]);
    expect(out.sellingUnit).toBe('strip');
    expect(out.unitMultiplier).toBe(10);
    expect(out.quantity).toBe(3);
    expect(out.itemPrice).toBe(28);
    expect(out.totalPrice).toBe(84);
  });

  it('drops zero-quantity units rather than storing empty rungs', () => {
    const out = rollUpMixed(mixed(), [
      { ...STRIP, qty: 1 },
      { ...TABLET, qty: 0 },
    ]);
    expect(out.unitLines).toHaveLength(1);
    expect(out.sellingUnit).toBe('strip');
  });

  it('preserves every other field on the line, including the ones with no UI', () => {
    const line: OrderLine = {
      ...single(),
      productSnapshot: { name: 'Paracetamol' },
      returnReason: 'damaged',
      status: 'DELIVERED',
    };
    const out = rollUpMixed(line, [
      { ...STRIP, qty: 1 },
      { ...TABLET, qty: 2 },
    ]);
    expect(out.productSnapshot).toEqual({ name: 'Paracetamol' });
    expect(out.returnReason).toBe('damaged');
    expect(out.status).toBe('DELIVERED');
    expect(out.productId).toBe(9);
  });
});

describe('editing units', () => {
  it('changes one unit and re-rolls the line', () => {
    const out = updateUnitQty(mixed(), 1, 10);
    expect(lineBaseQty(out)).toBe(20);
    expect(out.totalPrice).toBe(28 + 60);
  });

  it('removes a unit and collapses to a plain line', () => {
    const out = removeUnit(mixed(), 1);
    expect(isMixedLine(out)).toBe(false);
    expect(out.sellingUnit).toBe('strip');
  });

  it('adds a rung, turning a plain line into a mixed one', () => {
    const out = addUnit(single(), TABLET, 4);
    expect(isMixedLine(out)).toBe(true);
    expect(lineBaseQty(out)).toBe(24);
  });

  it('folds into the existing rung instead of appending a duplicate unit', () => {
    // Two rows both saying "strip" would render twice and roll up the same, so the add is really a
    // quantity change.
    const out = addUnit(single(), STRIP, 1);
    expect(displayUnitLines(out)).toHaveLength(1);
    expect(out.quantity).toBe(3);
  });

  it('swaps which unit a single-unit line is sold in, keeping the quantity', () => {
    const out = selectUnit(single(), 0, BOX);
    expect(out.sellingUnit).toBe('box');
    expect(out.unitMultiplier).toBe(100);
    expect(out.quantity).toBe(2);
    expect(out.itemPrice).toBe(250);
  });
});

describe('labels', () => {
  const money = (n: number) => `₹${n}`;

  it('summarises a mixed line by its units', () => {
    expect(mixedLabel(mixed())).toBe('1 strip · 4 tablet');
  });

  it('says "each" only when there is more than one', () => {
    expect(unitSummary(single(), money)).toBe('2 strip · ₹28 each');
    expect(unitSummary({ ...single(), quantity: 1 }, money)).toBe('1 strip · ₹28');
  });

  it('lists every unit for a mixed line', () => {
    expect(unitSummary(mixed(), money)).toBe('1 strip · ₹28  ·  4 tablet · ₹6');
  });

  it('is empty for a line with no units yet', () => {
    expect(
      unitSummary({ productId: 1, quantity: 0, itemPrice: 0, totalPrice: 0, discount: 0 }, money),
    ).toBe('');
  });
});

describe('catalog', () => {
  it('reads a ladder and drops rungs with no unit name', () => {
    expect(saleUnitsOf({ saleUnits: [STRIP, { perStock: 1, price: 6 }] })).toEqual([STRIP]);
  });

  it('defaults a missing perStock to 1 rather than 0, which would zero every quantity', () => {
    expect(saleUnitsOf({ saleUnits: [{ unit: 'piece', price: 5 }] })).toEqual([
      { unit: 'piece', perStock: 1, price: 5 },
    ]);
  });

  it('handles a product with no ladder at all', () => {
    expect(saleUnitsOf({})).toEqual([]);
    expect(saleUnitsOf(null)).toEqual([]);
  });

  it('seeds a picked product on its base rung, so the line is valid at quantity 1', () => {
    expect(baseSaleUnit([BOX, STRIP, TABLET])).toEqual(TABLET);
    expect(baseSaleUnit([BOX, STRIP])).toEqual(BOX);
    expect(baseSaleUnit([])).toBeNull();
  });
});
