import {
  baseEquivalenceLabel,
  baseSaleUnit,
  displayLevel,
  effMult,
  formatStockedQty,
  perUnitLabel,
  priceFieldLabel,
  quantityFieldLabel,
  resolveSaleUnit,
  unitHelperLine,
  unitPickerValue,
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
