import {
  aggregatePoolStock,
  availabilityHelper,
  formatPoolQty,
  groupDigits,
  outOfStockNote,
  pickerStock,
  poolStockFor,
  rowIsOutOfStock,
} from './poolStock';

describe('aggregatePoolStock', () => {
  it('sums one product across its batches', () => {
    const pool = aggregatePoolStock([
      { itemId: 21, remainingQuantity: 4000 },
      { itemId: 21, remainingQuantity: 1500 },
      { itemId: 21, remainingQuantity: 500 },
      { itemId: 99, remainingQuantity: 30 },
    ]);
    expect(pool.get(21)).toEqual({ itemId: 21, baseQty: 6000, batchCount: 3 });
    expect(pool.get(99)).toEqual({ itemId: 99, baseQty: 30, batchCount: 1 });
  });

  it('counts an EMPTY batch into neither figure', () => {
    // "0 ml across 1 batch" invites a tap that can only ever be refused.
    const pool = aggregatePoolStock([
      { itemId: 21, remainingQuantity: 0 },
      { itemId: 21, remainingQuantity: null },
    ]);
    expect(pool.has(21)).toBe(false);
  });

  it('drops a batch it cannot attribute to a product', () => {
    expect(aggregatePoolStock([{ remainingQuantity: 500 }]).size).toBe(0);
  });

  it('survives an empty or absent list', () => {
    expect(aggregatePoolStock([]).size).toBe(0);
    expect(aggregatePoolStock(null).size).toBe(0);
  });
});

describe('poolStockFor', () => {
  it('tells "not fetched yet" apart from "fetched, and there is none"', () => {
    // Collapsing the two greys out every row for the moment before the response lands.
    expect(poolStockFor(null, 21)).toBeNull();
    expect(poolStockFor(new Map(), 21)).toEqual({ itemId: 21, baseQty: 0, batchCount: 0 });
  });

  it('is null without a product', () => {
    expect(poolStockFor(new Map(), null)).toBeNull();
  });
});

describe('groupDigits', () => {
  it('groups in threes and leaves short numbers alone', () => {
    expect(groupDigits(6000)).toBe('6,000');
    expect(groupDigits(600)).toBe('600');
    expect(groupDigits(600000)).toBe('600,000');
    expect(groupDigits(0)).toBe('0');
  });

  it('is engine-independent, unlike toLocaleString', () => {
    // The whole reason this is hand-written: an en-IN locale groups 600000 as "6,00,000".
    expect(groupDigits(600000)).not.toBe('6,00,000');
  });
});

describe('formatPoolQty', () => {
  it('groups the figure and leaves a measure symbol un-pluralised', () => {
    expect(formatPoolQty(6000, 'ml')).toBe('6,000 ml');
    expect(formatPoolQty(1530, 'g')).toBe('1,530 g');
  });

  it('still pluralises a countable unit', () => {
    expect(formatPoolQty(4200, 'sachet')).toBe('4,200 sachets');
    expect(formatPoolQty(1, 'sachet')).toBe('1 sachet');
  });
});

describe('availabilityHelper', () => {
  it('states the total, the batch spread and the draw order', () => {
    expect(availabilityHelper({ itemId: 21, baseQty: 6000, batchCount: 3 }, 'ml')).toBe(
      'Available: 6,000 ml across 3 batches · drawn FEFO (soonest expiry first).',
    );
  });

  it('says "batch" when there is only one', () => {
    expect(availabilityHelper({ itemId: 21, baseQty: 500, batchCount: 1 }, 'ml')).toContain(
      'across 1 batch ·',
    );
  });

  it('names the SOURCE pool when there is nothing to move', () => {
    expect(availabilityHelper({ itemId: 21, baseQty: 0, batchCount: 0 }, 'ml', 'RAW_INVENTORY')).toBe(
      'No stock in the Raw pool.',
    );
  });

  it('draws no helper at all before a product is picked', () => {
    // "Available: 0 ml" on an untouched form reads as a refusal.
    expect(availabilityHelper(null, 'ml')).toBeNull();
  });
});

describe('pickerStock', () => {
  it('puts the total on top and the batch spread under it', () => {
    expect(pickerStock({ itemId: 21, baseQty: 6000, batchCount: 3 }, 'ml')).toEqual({
      total: '6,000 ml',
      breakdown: '3 batches',
    });
  });

  it('drops the breakdown at zero — "0 batches" restates the total', () => {
    expect(pickerStock({ itemId: 21, baseQty: 0, batchCount: 0 }, 'ml')).toEqual({
      total: '0 ml',
      breakdown: null,
    });
  });

  it('draws nothing while the pool is unknown', () => {
    expect(pickerStock(null, 'ml')).toBeNull();
  });
});

describe('rowIsOutOfStock', () => {
  it('is inert only at a KNOWN zero', () => {
    expect(rowIsOutOfStock({ itemId: 21, baseQty: 0, batchCount: 0 })).toBe(true);
    expect(rowIsOutOfStock({ itemId: 21, baseQty: 5, batchCount: 1 })).toBe(false);
    // Greying out the whole catalog while the batches load looks like a broken screen.
    expect(rowIsOutOfStock(null)).toBe(false);
  });

  it('follows the DIRECTION — a product can be pickable one way and not the other', () => {
    const raw = { itemId: 21, baseQty: 0, batchCount: 0 };
    const product = { itemId: 21, baseQty: 6000, batchCount: 3 };
    expect(rowIsOutOfStock(product)).toBe(false);
    expect(rowIsOutOfStock(raw)).toBe(true);
    expect(outOfStockNote(raw, 'RAW_INVENTORY')).toBe('no Raw stock');
    expect(outOfStockNote(product, 'PRODUCT_INVENTORY')).toBeNull();
  });
});
