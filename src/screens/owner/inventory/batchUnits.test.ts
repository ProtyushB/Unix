import {
  baseEquivalenceLabel,
  baseSaleUnit,
  clampUnitRows,
  deriveUnitLinesPayload,
  displayLevel,
  effMult,
  formatStockedQty,
  isMixedUnitLines,
  mixedUnitLabel,
  perUnitLabel,
  priceFieldLabel,
  quantityFieldLabel,
  recordQtyLabel,
  resolveSaleUnit,
  showsAddUnitRow,
  sortUnitLinesDesc,
  unitHelperLine,
  unitLinesBaseQty,
  unitPickerValue,
  unitRowsRollup,
  saleUnitsOf,
  showsUnitPicker,
  stockValueAtCost,
  toBasePrice,
  toBaseQty,
} from './batchUnits';

const BOX = { unit: 'box', perStock: 12 };
const SACHET = { unit: 'sachet', perStock: 1 };

describe('effMult', () => {
  it('floors to a whole number and never goes below 1', () => {
    // Mirrors the backend's effMult deliberately — the two must agree or quantities diverge.
    expect(effMult(12)).toBe(12);
    expect(effMult(12.9)).toBe(12);
    expect(effMult(0)).toBe(1);
    expect(effMult(-5)).toBe(1);
    expect(effMult(null)).toBe(1);
    expect(effMult('abc')).toBe(1);
    expect(effMult(undefined)).toBe(1);
  });
});

describe('the write direction', () => {
  it('MULTIPLIES quantities up to base units', () => {
    // 50 boxes of 12 is 600 sachets. Dividing here would store 4 and lose 596 sachets of stock.
    expect(toBaseQty(50, 12)).toBe(600);
    expect(toBaseQty('50', 12)).toBe(600);
    expect(toBaseQty(20, 1)).toBe(20);
  });

  it('DIVIDES prices down to per-base', () => {
    // A box costing 420 is 35 a sachet. Multiplying would price every sachet at a box's cost.
    expect(toBasePrice(420, 12)).toBe(35);
    expect(toBasePrice('650', 12)).toBeCloseTo(54.1667, 4);
    expect(toBasePrice(180, 1)).toBe(180);
  });

  it('keeps four decimals on a price that does not divide evenly', () => {
    // At 2dp this rounds to 33.33 and a 600-unit batch is valued ~2 rupees light.
    expect(toBasePrice(100, 3)).toBe(33.3333);
  });

  it('passes a missing price through as null, which is NOT zero', () => {
    // The server reads null as "use the product's price"; zero would mean free.
    expect(toBasePrice(null, 12)).toBeNull();
    expect(toBasePrice(undefined, 12)).toBeNull();
    expect(toBasePrice('', 12)).toBeNull();
    expect(toBasePrice('abc', 12)).toBeNull();
  });

  it('rounds quantities to whole base units', () => {
    expect(toBaseQty(2.5, 3)).toBe(8);
    expect(toBaseQty('x', 12)).toBe(0);
  });

  it('round-trips a quantity back through the multiplier', () => {
    const mult = 12;
    expect(formatStockedQty(toBaseQty(50, mult), BOX)).toBe('50 boxes');
  });
});

describe('saleUnitsOf / baseSaleUnit / resolveSaleUnit', () => {
  it('reads a ladder and drops rungs with no unit name', () => {
    expect(saleUnitsOf({ saleUnits: [BOX, { perStock: 1 }] })).toEqual([
      { unit: 'box', perStock: 12, price: 0 },
    ]);
  });

  it('defaults a missing perStock to 1 rather than 0, which would zero every quantity', () => {
    expect(saleUnitsOf({ saleUnits: [{ unit: 'piece' }] })[0].perStock).toBe(1);
  });

  it('survives a product with no ladder', () => {
    expect(saleUnitsOf({})).toEqual([]);
    expect(saleUnitsOf(null)).toEqual([]);
    expect(baseSaleUnit([])).toBeNull();
  });

  it('picks the base rung, else the first', () => {
    expect(baseSaleUnit([BOX, SACHET])).toEqual(SACHET);
    expect(baseSaleUnit([BOX])).toEqual(BOX);
  });

  it('falls back to the base rung when the named unit is gone from the ladder', () => {
    // A product edited after the batch was drafted should not leave the form on a dead unit.
    expect(resolveSaleUnit([BOX, SACHET], 'strip')).toEqual(SACHET);
    expect(resolveSaleUnit([BOX, SACHET], 'box')).toEqual(BOX);
    expect(resolveSaleUnit([], 'box')).toBeNull();
  });
});

describe('showsUnitPicker', () => {
  it('needs something to choose between', () => {
    // A dropdown with one option is furniture — the mockup s empty add screen has no such field.
    expect(showsUnitPicker([])).toBe(false);
    expect(showsUnitPicker([SACHET])).toBe(false);
    expect(showsUnitPicker([BOX, SACHET])).toBe(true);
  });
});

describe('formatStockedQty', () => {
  it('renders base units in the stock-in unit', () => {
    expect(formatStockedQty(600, BOX, 'sachet')).toBe('50 boxes');
  });

  it('shows the remainder rather than rounding real stock away', () => {
    // 596 sachets is 49 boxes and 8 loose. "49 boxes" would lose them.
    expect(formatStockedQty(596, BOX, 'sachet')).toBe('49 boxes · 8 sachets');
  });

  it('falls back to the plain base count when the batch records no level', () => {
    // Legacy rows and combo-break batches: we genuinely do not know what they were bought in.
    expect(formatStockedQty(144, null, 'sachet')).toBe('144 sachets');
    expect(formatStockedQty(144, SACHET, 'sachet')).toBe('144 sachets');
  });

  it('does not pluralise a count of one', () => {
    expect(formatStockedQty(12, BOX, 'sachet')).toBe('1 box');
    expect(formatStockedQty(1, null, 'sachet')).toBe('1 sachet');
  });

  it('pluralises units ending in a sibilant with -es, on both the level and the base', () => {
    // A perStock of 1 IS the base unit, so that branch reads `baseUnit` — the level name is only
    // used when it actually differs from the base.
    expect(formatStockedQty(2, null, 'box')).toBe('2 boxes');
    expect(formatStockedQty(2, null, 'patch')).toBe('2 patches');
    expect(formatStockedQty(2, null, 'bottle')).toBe('2 bottles');
    expect(formatStockedQty(24, BOX, 'sachet')).toBe('2 boxes');
    expect(formatStockedQty(25, { unit: 'batch', perStock: 12 }, 'patch')).toBe(
      '2 batches · 1 patch',
    );
  });

  it('handles zero and missing quantities', () => {
    expect(formatStockedQty(0, BOX, 'sachet')).toBe('0 boxes');
    expect(formatStockedQty(null, null, 'unit')).toBe('0 units');
  });

  it('leaves MEASURE units alone — "4,200 mls" is not a quantity anyone writes', () => {
    // Raw stock is measured far more often than it is counted, and every mockup writes "4,200 ml"
    // and "1,530 g". A naive pluralizer produced "mls"/"gs" on the busiest label in the app.
    expect(formatStockedQty(4200, null, 'ml')).toBe('4200 ml');
    expect(formatStockedQty(1530, null, 'g')).toBe('1530 g');
    expect(formatStockedQty(1530, { unit: 'tub', perStock: 500 }, 'g')).toBe('3 tubs · 30 g');
    // Case-insensitively, because a catalog can be entered as "ML".
    expect(formatStockedQty(200, null, 'ML')).toBe('200 ML');
    // Still pluralises real nouns of the same length.
    expect(formatStockedQty(2, null, 'jar')).toBe('2 jars');
  });
});

describe('baseEquivalenceLabel', () => {
  it('spells out what a multi-unit quantity becomes, in "base units"', () => {
    // The generic phrase is deliberate: it flags that the number is in a DIFFERENT currency from
    // the one being typed. "= 600 sachets" reads as just another quantity.
    expect(baseEquivalenceLabel(50, 12)).toBe('= 600 base units');
  });

  it('says nothing when there is nothing to clarify', () => {
    // A base-unit product: "= 20 base units" restates the field above it.
    expect(baseEquivalenceLabel(20, 1)).toBeNull();
    expect(baseEquivalenceLabel('', 12)).toBeNull();
    expect(baseEquivalenceLabel(0, 12)).toBeNull();
    // Mid-typing a decimal should not flash a bogus total.
    expect(baseEquivalenceLabel(2.5, 12)).toBeNull();
  });
});

describe('add-form labels', () => {
  const PACK = { unit: 'pack', perStock: 12 };

  it('shows the multiplier in the unit picker', () => {
    expect(unitPickerValue(PACK)).toBe('pack (×12)');
  });

  it('calls a base rung "Base unit" rather than naming it with a ×1', () => {
    expect(unitPickerValue(SACHET)).toBe('Base unit');
    expect(unitPickerValue(null)).toBe('Base unit');
  });

  it('explains the conversion in a sentence', () => {
    expect(unitHelperLine(PACK, 'sachet')).toBe(
      '1 pack = 12 sachets; quantities and prices below are per pack.',
    );
  });

  it('has no conversion to explain for a base-unit product', () => {
    expect(unitHelperLine(SACHET, 'sachet')).toBeNull();
    expect(unitHelperLine(null)).toBeNull();
  });

  it('puts the unit in the quantity label, pluralised', () => {
    expect(quantityFieldLabel('Purchased Quantity', PACK)).toBe('Purchased Quantity (packs)');
    expect(quantityFieldLabel('Remaining Quantity', { unit: 'box', perStock: 6 })).toBe(
      'Remaining Quantity (boxes)',
    );
  });

  it('leaves the quantity label bare when there is no unit in play', () => {
    expect(quantityFieldLabel('Purchased Quantity', SACHET)).toBe('Purchased Quantity');
    expect(quantityFieldLabel('Purchased Quantity', null)).toBe('Purchased Quantity');
  });

  it('puts the currency AND the unit in the price label', () => {
    // The digits mean something different per unit, so the label has to say which.
    expect(priceFieldLabel('Cost Price', PACK)).toBe('Cost Price (₹/pack)');
    expect(priceFieldLabel('Selling Price', PACK)).toBe('Selling Price (₹/pack)');
  });

  it('still shows the currency for a base-unit product', () => {
    expect(priceFieldLabel('Cost Price', SACHET)).toBe('Cost Price (₹)');
    expect(priceFieldLabel('Cost Price', null)).toBe('Cost Price (₹)');
  });
});

describe('perUnitLabel', () => {
  it('explains the multiplier under the picker', () => {
    expect(perUnitLabel(BOX, 'sachet')).toBe('12 sachets per box');
  });

  it('is silent for a base-unit product', () => {
    expect(perUnitLabel(SACHET, 'sachet')).toBeNull();
    expect(perUnitLabel(null)).toBeNull();
  });
});

describe('stockValueAtCost', () => {
  it('multiplies remaining base units by the per-base cost', () => {
    // 144 sachets at 35 each.
    expect(stockValueAtCost(144, 35)).toBe(5040);
  });

  it('is null when either side is unknown, so the row can omit it', () => {
    expect(stockValueAtCost(144, null)).toBeNull();
    expect(stockValueAtCost(null, 35)).toBeNull();
  });
});

describe('displayLevel', () => {
  it('reads the level the batch was stocked in', () => {
    expect(displayLevel({ stockInUnit: 'box', stockInMultiplier: 12 })).toEqual(BOX);
  });

  it('is null when the batch records none', () => {
    expect(displayLevel({})).toBeNull();
    expect(displayLevel({ stockInUnit: null, stockInMultiplier: 12 })).toBeNull();
  });

  it('repairs a corrupt multiplier rather than dividing by zero downstream', () => {
    expect(displayLevel({ stockInUnit: 'box', stockInMultiplier: 0 })).toEqual({
      unit: 'box',
      perStock: 1,
    });
  });
});

// ─── Mixed units ─────────────────────────────────────────────────────────────

const STRIP = { unit: 'strip', perStock: 15, qty: 1 };
const TABLET = { unit: 'tablet', perStock: 1, qty: 8 };

describe('isMixedUnitLines', () => {
  it('needs TWO rows — one level is not a mix', () => {
    // The row count, not the array's presence, is what picks the branch everywhere downstream. A
    // single-row array that counted as mixed would render its breakdown and its scalar differently
    // for the same record.
    expect(isMixedUnitLines([STRIP, TABLET])).toBe(true);
    expect(isMixedUnitLines([STRIP])).toBe(false);
    expect(isMixedUnitLines([])).toBe(false);
    expect(isMixedUnitLines(null)).toBe(false);
    expect(isMixedUnitLines(undefined)).toBe(false);
  });
});

describe('unitLinesBaseQty', () => {
  it('multiplies each row out and sums them', () => {
    // 1 strip of 15 plus 8 loose tablets is 23 tablets.
    expect(unitLinesBaseQty([STRIP, TABLET])).toBe(23);
  });

  it('repairs a corrupt rung rather than zeroing the row', () => {
    // effMult floors to at least 1, so a perStock of 0 counts the qty rather than discarding it.
    expect(unitLinesBaseQty([{ unit: 'x', perStock: 0, qty: 5 }])).toBe(5);
  });

  it('is zero for nothing', () => {
    expect(unitLinesBaseQty([])).toBe(0);
    expect(unitLinesBaseQty(null)).toBe(0);
  });
});

describe('sortUnitLinesDesc', () => {
  it('puts the highest level first', () => {
    expect(sortUnitLinesDesc([TABLET, STRIP]).map((l) => l.unit)).toEqual(['strip', 'tablet']);
  });

  it('does NOT mutate its input, because these arrays are React state', () => {
    // Array.prototype.sort sorts in place. Sorting the caller's array would edit the state object
    // it is still holding and skip the re-render.
    const rows = [TABLET, STRIP];
    sortUnitLinesDesc(rows);
    expect(rows.map((l) => l.unit)).toEqual(['tablet', 'strip']);
  });
});

describe('mixedUnitLabel', () => {
  it('joins with · — NOT the + Centrix uses', () => {
    // Deliberate divergence. formatStockedQty already renders "49 boxes · 8 sachets" for the same
    // idea, and a batch shown with · beside a consumption shown with + reads as two different
    // kinds of number.
    expect(mixedUnitLabel([STRIP, TABLET])).toBe('1 strip · 8 tablets');
  });

  it('orders high level first regardless of the order they were entered', () => {
    expect(mixedUnitLabel([TABLET, STRIP])).toBe('1 strip · 8 tablets');
  });

  it('drops rows the user left blank', () => {
    expect(mixedUnitLabel([STRIP, { unit: 'tablet', perStock: 1, qty: 0 }])).toBe('1 strip');
  });

  it('names an unnamed base rung after the base unit rather than leaving a hole', () => {
    expect(mixedUnitLabel([{ unit: '', perStock: 1, qty: 8 }], 'tablet')).toBe('8 tablets');
  });

  it('is empty when there is nothing to say', () => {
    expect(mixedUnitLabel([])).toBe('');
    expect(mixedUnitLabel(null)).toBe('');
  });
});

describe('recordQtyLabel', () => {
  it('reads the breakdown on a mixed record', () => {
    expect(recordQtyLabel({ quantity: 23, unitName: null, unitLines: [STRIP, TABLET] })).toBe(
      '1 strip · 8 tablets',
    );
  });

  it('reads the scalar and its unit on a single-level record', () => {
    expect(recordQtyLabel({ quantity: 2, unitName: 'bottle', unitLines: null })).toBe('2 bottles');
  });

  it('falls back to the base unit when the record names none', () => {
    expect(recordQtyLabel({ quantity: 30, unitName: null }, 'ml')).toBe('30 ml');
  });

  it('renders a missing quantity as an em dash, NOT as zero', () => {
    // A record with no quantity recorded is not a record of zero.
    expect(recordQtyLabel({ quantity: null })).toBe('—');
    expect(recordQtyLabel({})).toBe('—');
  });
});

describe('deriveUnitLinesPayload', () => {
  it('collapses ONE row to a scalar in LEVEL units', () => {
    // quantity stays 1 (one strip) and the multiplier carries the 15 — the server does the
    // multiplication. Sending 15 here as well would deduct 225 tablets.
    expect(deriveUnitLinesPayload([STRIP])).toEqual({
      quantity: 1,
      unitName: 'strip',
      unitMultiplier: 15,
      unitLines: null,
    });
  });

  it('sends TWO rows as a BASE total with a multiplier of 1', () => {
    // The branch that is silent when wrong: leave unitMultiplier on 15 while quantity already holds
    // the base total and the server deducts fifteen times too much.
    expect(deriveUnitLinesPayload([STRIP, TABLET])).toEqual({
      quantity: 23,
      unitName: null,
      unitMultiplier: 1,
      unitLines: [
        { unit: 'strip', perStock: 15, qty: 1 },
        { unit: 'tablet', perStock: 1, qty: 8 },
      ],
    });
  });

  it('keeps the two branches equivalent: quantity × multiplier is the same deduction', () => {
    const scalar = deriveUnitLinesPayload([{ unit: 'strip', perStock: 15, qty: 2 }])!;
    const mixed = deriveUnitLinesPayload([
      { unit: 'strip', perStock: 15, qty: 1 },
      { unit: 'tablet', perStock: 1, qty: 15 },
    ])!;
    expect(scalar.quantity * scalar.unitMultiplier).toBe(30);
    expect(mixed.quantity * mixed.unitMultiplier).toBe(30);
  });

  it('drops blank rows BEFORE choosing the branch', () => {
    // Two rows with one left empty is a single-level record, not a mixed one. Choosing the branch
    // first would send a one-element unitLines and a base total the server reads as level units.
    expect(deriveUnitLinesPayload([STRIP, { unit: 'tablet', perStock: 1, qty: 0 }])).toEqual({
      quantity: 1,
      unitName: 'strip',
      unitMultiplier: 15,
      unitLines: null,
    });
  });

  it('is null when nothing is filled in, so the caller can fail validation instead of posting 0', () => {
    expect(deriveUnitLinesPayload([])).toBeNull();
    expect(deriveUnitLinesPayload(null)).toBeNull();
    expect(deriveUnitLinesPayload([{ unit: 'strip', perStock: 15, qty: 0 }])).toBeNull();
  });

  it('sends a nameless base rung as null, not as an empty string', () => {
    // The server reads '' as a unit literally called "", not as "no unit".
    expect(deriveUnitLinesPayload([{ unit: '', perStock: 1, qty: 8 }])?.unitName).toBeNull();
  });
});

describe('clampUnitRows', () => {
  it('keeps every row when multiples are allowed', () => {
    expect(clampUnitRows([STRIP, TABLET], true)).toHaveLength(2);
  });

  it('clamps to ONE when they are not — which is what stock transfer passes', () => {
    // The server DISCARDS unitLines on a transfer and rebuilds the destination batch from the
    // scalar total, so a second row would be typed, sent, dropped, and missing from the detail
    // screen the user lands on.
    expect(clampUnitRows([STRIP, TABLET], false)).toEqual([STRIP]);
  });

  it('returns a copy rather than the callers array', () => {
    const rows = [STRIP];
    expect(clampUnitRows(rows, true)).not.toBe(rows);
  });
});

describe('showsAddUnitRow', () => {
  it('is hidden when the caller forbids multiples', () => {
    expect(showsAddUnitRow({ allowMultiple: false, rowCount: 1, ladderSize: 3 })).toBe(false);
  });

  it('is hidden for a base-unit product, where Add could only duplicate the row already there', () => {
    expect(showsAddUnitRow({ allowMultiple: true, rowCount: 1, ladderSize: 1 })).toBe(false);
    expect(showsAddUnitRow({ allowMultiple: true, rowCount: 0, ladderSize: 0 })).toBe(false);
  });

  it('is hidden once every rung is on screen', () => {
    expect(showsAddUnitRow({ allowMultiple: true, rowCount: 2, ladderSize: 2 })).toBe(false);
  });

  it('shows while the ladder still has a rung to offer', () => {
    expect(showsAddUnitRow({ allowMultiple: true, rowCount: 1, ladderSize: 2 })).toBe(true);
  });
});

describe('unitRowsRollup', () => {
  it('converts the rows to BASE units and compares them against the stock', () => {
    // Both figures are base units — that is the point. Rendering the entered total in levels would
    // restate the rows instead of converting them.
    expect(unitRowsRollup([{ unit: 'g', perStock: 1, qty: 45 }], 180, 'g')).toBe(
      '= 45 g of 180 g available',
    );
  });

  it('adds up a mixed entry before comparing', () => {
    expect(unitRowsRollup([STRIP, TABLET], 300, 'tablet')).toBe(
      '= 23 tablets of 300 tablets available',
    );
  });

  it('says nothing at all while the editor is untouched', () => {
    // "= 0 g of 180 g available" on an empty form reads as an error rather than as a blank.
    expect(unitRowsRollup([], 180, 'g')).toBeNull();
    expect(unitRowsRollup(null, 180, 'g')).toBeNull();
  });

  it('drops the "of N available" tail when the stock is UNKNOWN, rather than claiming zero', () => {
    // No product picked yet. null is not 0.
    expect(unitRowsRollup([{ unit: 'g', perStock: 1, qty: 45 }], null, 'g')).toBe('= 45 g');
    expect(unitRowsRollup([{ unit: 'g', perStock: 1, qty: 45 }], undefined, 'g')).toBe('= 45 g');
  });

  it('does show a real zero, which is a different fact from an unknown one', () => {
    expect(unitRowsRollup([{ unit: 'g', perStock: 1, qty: 45 }], 0, 'g')).toBe(
      '= 45 g of 0 g available',
    );
  });
});
