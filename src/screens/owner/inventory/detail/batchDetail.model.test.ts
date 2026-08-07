import {
  buildCreatePayload,
  catalogBadge,
  emptyForm,
  sourceLabel,
  toFormState,
} from './batchDetail.model';

const NOW = new Date('2026-08-07T06:00:00Z');

describe('emptyForm', () => {
  it('defaults received date to today IST, which is what the server would default to anyway', () => {
    expect(emptyForm(NOW).receivedDate).toBe('2026-08-07');
  });

  it('starts in the Product pool with a base-unit multiplier', () => {
    const f = emptyForm(NOW);
    expect(f.inventoryType).toBe('PRODUCT_INVENTORY');
    expect(f.stockInMultiplier).toBe(1);
    expect(f.itemId).toBeNull();
  });

  it('carries no status field — a batch is always born ACTIVE, server-forced', () => {
    expect(Object.keys(emptyForm(NOW))).not.toContain('status');
  });

  it('uses the IST day even when the device is still on the previous one', () => {
    expect(emptyForm(new Date('2026-08-06T18:45:00Z')).receivedDate).toBe('2026-08-07');
  });
});

describe('toFormState', () => {
  it('reads a saved batch, leaving quantities in BASE units', () => {
    // Dividing back into the stock-in unit would round a partially-drawn batch: 137 sachets is not
    // a whole number of 12-sachet boxes.
    const f = toFormState(
      {
        itemId: 9,
        itemName: 'Keratin Smooth Mask',
        inventoryType: 'RAW_INVENTORY',
        supplierName: 'L’Oréal Pro',
        manufactureDate: '2026-07-22',
        expiryDate: '2026-09-30',
        receivedDate: '2026-07-22',
        purchasedQuantity: 600,
        remainingQuantity: 137,
        costPrice: 35,
        stockInUnit: 'box',
        stockInMultiplier: 12,
      },
      NOW,
    );
    expect(f.inventoryType).toBe('RAW_INVENTORY');
    expect(f.purchasedQuantity).toBe('600');
    expect(f.remainingQuantity).toBe('137');
    expect(f.stockInMultiplier).toBe(12);
    expect(f.costPrice).toBe('35');
  });

  it('renders a null field as an empty string, not "null"', () => {
    const f = toFormState({ itemId: 1, supplierName: null, costPrice: null }, NOW);
    expect(f.supplierName).toBe('');
    expect(f.costPrice).toBe('');
  });

  it('trims a full timestamp back to a date', () => {
    expect(toFormState({ expiryDate: '2026-09-30T00:00:00Z' }, NOW).expiryDate).toBe('2026-09-30');
  });

  it('falls back to a blank form for a missing batch', () => {
    expect(toFormState(null, NOW)).toEqual(emptyForm(NOW));
  });

  it('repairs a corrupt multiplier rather than propagating a divide-by-zero', () => {
    expect(toFormState({ stockInMultiplier: 0 }, NOW).stockInMultiplier).toBe(1);
  });
});

describe('buildCreatePayload', () => {
  const base = () => ({
    ...emptyForm(NOW),
    itemId: 9,
    itemName: 'Keratin Smooth Mask',
    stockInUnit: 'box',
    stockInMultiplier: 12,
    purchasedQuantity: '50',
    costPrice: '420',
    sellingPrice: '650',
  });

  it('MULTIPLIES quantities up to base units', () => {
    // 50 boxes of 12 is 600 sachets. Sending 50 would under-stock by a factor of twelve.
    const p = buildCreatePayload(base(), 3);
    expect(p.purchasedQuantity).toBe(600);
  });

  it('DIVIDES prices down to per-base', () => {
    // A box costing 420 is 35 a sachet. Sending 420 would price every sachet at a box's cost.
    const p = buildCreatePayload(base(), 3);
    expect(p.costPrice).toBe(35);
    expect(p.sellingPrice).toBeCloseTo(54.1667, 4);
  });

  it('defaults remaining to purchased, in base units', () => {
    const p = buildCreatePayload({ ...base(), remainingQuantity: '' }, 3);
    expect(p.remainingQuantity).toBe(600);
  });

  it('converts an explicit remaining through the same multiplier', () => {
    const p = buildCreatePayload({ ...base(), remainingQuantity: '20' }, 3);
    expect(p.remainingQuantity).toBe(240);
  });

  it('snapshots the chosen level so the list can render the quantity back', () => {
    const p = buildCreatePayload(base(), 3);
    expect(p.stockInUnit).toBe('box');
    expect(p.stockInMultiplier).toBe(12);
  });

  it('omits status, batchNumber and id — all server-owned', () => {
    const p = buildCreatePayload(base(), 3);
    expect(p).not.toHaveProperty('status');
    expect(p).not.toHaveProperty('batchNumber');
    expect(p).not.toHaveProperty('id');
  });

  it('sends null for an unset price, which is NOT the same as zero', () => {
    // Null tells the server to use the product's price; zero would mean free.
    const p = buildCreatePayload({ ...base(), costPrice: '', sellingPrice: '' }, 3);
    expect(p.costPrice).toBeNull();
    expect(p.sellingPrice).toBeNull();
  });

  it('sends null rather than an empty string for blank dates and supplier', () => {
    const p = buildCreatePayload({ ...base(), supplierName: '   ', expiryDate: '' }, 3);
    expect(p.supplierName).toBeNull();
    expect(p.expiryDate).toBeNull();
  });

  it('leaves a base-unit product untouched', () => {
    const p = buildCreatePayload(
      {
        ...base(),
        stockInUnit: '',
        stockInMultiplier: 1,
        purchasedQuantity: '20',
        costPrice: '180',
      },
      3,
    );
    expect(p.purchasedQuantity).toBe(20);
    expect(p.costPrice).toBe(180);
    expect(p.stockInUnit).toBeNull();
  });

  it('carries the business id the caller was given', () => {
    expect(buildCreatePayload(base(), 42).businessId).toBe(42);
  });
});

describe('catalogBadge', () => {
  it('appends the combo type, which says whether the contents are fixed', () => {
    expect(catalogBadge({ productType: 'COMBO', comboType: 'CUSTOM' }).label).toBe('Combo · Custom');
    expect(catalogBadge({ productType: 'COMBO', comboType: 'FIXED' }).label).toBe('Combo · Fixed');
  });

  it('still says Combo when the server records no type', () => {
    // Half a label is worse than a short one — the combo fact is the part that matters.
    expect(catalogBadge({ productType: 'COMBO' }).label).toBe('Combo');
    expect(catalogBadge({ productType: 'COMBO', comboType: '  ' }).label).toBe('Combo');
  });

  it('labels everything else Normal, including a product with no type at all', () => {
    // The chip is on every row or it reads as a warning on the few that have it.
    expect(catalogBadge({ productType: 'NORMAL' }).label).toBe('Normal');
    expect(catalogBadge({}).label).toBe('Normal');
    expect(catalogBadge(null).label).toBe('Normal');
  });

  it('is tone-neutral — it identifies the product, it does not flag it', () => {
    expect(catalogBadge({ productType: 'COMBO', comboType: 'CUSTOM' }).tone).toBe('muted');
    expect(catalogBadge({}).tone).toBe('muted');
  });
});

describe('sourceLabel', () => {
  it('calls a hand-added batch a manual entry', () => {
    // The server stores null for these — it is not an unknown source, it is the normal one.
    expect(sourceLabel(null)).toBe('Manual entry');
    expect(sourceLabel(undefined)).toBe('Manual entry');
  });

  it('names the system sources', () => {
    expect(sourceLabel('COMBO_BREAK')).toBe('Combo break');
    expect(sourceLabel('STOCK_TRANSFER')).toBe('Stock transfer');
  });

  it('passes an unrecognised source through rather than hiding it', () => {
    expect(sourceLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});
