import {
  commitQuickDraft,
  doneLabel,
  emptyQuickDraft,
  newLineId,
  quickCountLabel,
  quickItemMeta,
  quickLineTotal,
  quickTotal,
  validateQuickDraft,
  type QuickBillItem,
  type QuickItemDraft,
} from './quickItem';

function draft(over: Partial<QuickItemDraft> = {}): QuickItemDraft {
  return { ...emptyQuickDraft(), ...over };
}

function item(over: Partial<QuickBillItem> = {}): QuickBillItem {
  return {
    lineId: 'a-b-c',
    name: 'Imported Clay Mask',
    price: 450,
    quantity: 2,
    unit: 'jar',
    discount: 0,
    dmsFolderId: null,
    photos: [],
    photo: null,
    ...over,
  };
}

describe('newLineId', () => {
  it('mints a v4 UUID', () => {
    expect(newLineId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('does not repeat itself', () => {
    // The id keys the DMS folder and the photos PATCH, so a collision would attach one item's
    // photo to another's line.
    const ids = new Set(Array.from({ length: 200 }, () => newLineId()));
    expect(ids.size).toBe(200);
  });
});

describe('emptyQuickDraft', () => {
  it('starts blank, with no photo', () => {
    expect(emptyQuickDraft()).toEqual({
      name: '',
      price: '',
      quantity: '',
      unit: '',
      photo: null,
    });
  });

  it('carries no kind and no duration — Quick Add is products only', () => {
    expect(emptyQuickDraft()).not.toHaveProperty('kind');
    expect(emptyQuickDraft()).not.toHaveProperty('durationMinutes');
  });
});

describe('validateQuickDraft', () => {
  it('accepts a name and a price alone', () => {
    expect(validateQuickDraft(draft({ name: 'Clay Mask', price: '450' }))).toEqual({});
  });

  it('names both missing fields at once', () => {
    // Both, not the first — the form shows an error per field, so stopping at one would leave the
    // second box unmarked.
    expect(validateQuickDraft(draft())).toEqual({
      name: 'Name is required',
      price: 'Price is required',
    });
  });

  it('treats a whitespace-only name as missing', () => {
    expect(validateQuickDraft(draft({ name: '   ', price: '450' })).name).toBe('Name is required');
  });

  it('refuses a zero or negative price', () => {
    const message = 'Enter a price greater than 0';
    expect(validateQuickDraft(draft({ name: 'X', price: '0' })).price).toBe(message);
    expect(validateQuickDraft(draft({ name: 'X', price: '-5' })).price).toBe(message);
  });

  it('refuses an unparseable price', () => {
    expect(validateQuickDraft(draft({ name: 'X', price: 'abc' })).price).toBe(
      'Enter a price greater than 0',
    );
  });

  it('lets a blank quantity through — blank MEANS one', () => {
    expect(
      validateQuickDraft(draft({ name: 'X', price: '10', quantity: '' })).quantity,
    ).toBeUndefined();
  });

  it('refuses a typed quantity below one', () => {
    expect(validateQuickDraft(draft({ name: 'X', price: '10', quantity: '0' })).quantity).toBe(
      'Quantity must be at least 1',
    );
  });

  it('never requires a photo or a unit', () => {
    expect(validateQuickDraft(draft({ name: 'X', price: '10' }))).toEqual({});
  });
});

describe('commitQuickDraft', () => {
  it('coerces the strings and keeps the id it was given', () => {
    const committed = commitQuickDraft(
      draft({ name: '  Clay Mask  ', price: '450', quantity: '2', unit: ' jar ' }),
      'fixed-id',
    );
    expect(committed).toEqual({
      lineId: 'fixed-id',
      name: 'Clay Mask',
      price: 450,
      quantity: 2,
      unit: 'jar',
      discount: 0,
      dmsFolderId: null,
      photos: [],
      photo: null,
    });
  });

  it('reads a blank quantity as one', () => {
    expect(commitQuickDraft(draft({ name: 'X', price: '10' }), 'id').quantity).toBe(1);
  });

  it('floors the quantity at one', () => {
    expect(commitQuickDraft(draft({ name: 'X', price: '10', quantity: '0' }), 'id').quantity).toBe(
      1,
    );
  });

  it('carries the staged photo across, unuploaded', () => {
    const photo = { uri: 'file:///mask.jpg', name: 'mask.jpg', type: 'image/jpeg', size: 12 };
    const committed = commitQuickDraft(draft({ name: 'X', price: '10', photo }), 'id');
    expect(committed.photo).toBe(photo);
    expect(committed.photos).toEqual([]);
    expect(committed.dmsFolderId).toBeNull();
  });

  it('builds no productId — that absence is what keeps this off the catalog channel', () => {
    expect(commitQuickDraft(draft({ name: 'X', price: '10' }), 'id')).not.toHaveProperty(
      'productId',
    );
  });
});

describe('quickLineTotal', () => {
  it('multiplies quantity by price', () => {
    expect(quickLineTotal({ price: 450, quantity: 2 })).toBe(900);
  });

  it('applies the percentage discount', () => {
    expect(quickLineTotal({ price: 100, quantity: 2, discount: 10 })).toBe(180);
  });

  it('clamps a discount outside 0-100 rather than inverting the line', () => {
    expect(quickLineTotal({ price: 100, quantity: 1, discount: 150 })).toBe(0);
    expect(quickLineTotal({ price: 100, quantity: 1, discount: -50 })).toBe(100);
  });

  it('reads absent fields as zero', () => {
    expect(quickLineTotal({})).toBe(0);
  });
});

describe('quickTotal', () => {
  it('sums the lines', () => {
    expect(quickTotal([item(), item({ price: 600, quantity: 1, unit: '' })])).toBe(1500);
  });

  it('is zero for no lines', () => {
    expect(quickTotal([])).toBe(0);
  });
});

describe('quickItemMeta', () => {
  it('reads "Qty 2 · ₹450 · jar" in the picker', () => {
    expect(quickItemMeta(item(), 'picker')).toBe('Qty 2 · ₹450 · jar');
  });

  it('reads "Quick add · 2 × ₹450 · jar" on the bill', () => {
    expect(quickItemMeta(item(), 'bill')).toBe('Quick add · 2 × ₹450 · jar');
  });

  it('drops the unit segment when there is no unit', () => {
    expect(quickItemMeta(item({ price: 600, quantity: 1, unit: '' }), 'picker')).toBe(
      'Qty 1 · ₹600',
    );
    expect(quickItemMeta(item({ price: 600, quantity: 1, unit: '  ' }), 'bill')).toBe(
      'Quick add · 1 × ₹600',
    );
  });
});

describe('doneLabel', () => {
  it('is a bare "Done" with nothing added', () => {
    expect(doneLabel([])).toBe('Done');
  });

  it('is singular for one item', () => {
    expect(doneLabel([item()])).toBe('Done · 1 item · ₹900');
  });

  it('counts and totals for several', () => {
    expect(doneLabel([item(), item({ price: 600, quantity: 1, unit: '' })])).toBe(
      'Done · 2 items · ₹1,500',
    );
  });
});

describe('quickCountLabel', () => {
  it('pluralises at zero and above one', () => {
    expect(quickCountLabel([])).toBe('0 items');
    expect(quickCountLabel([item()])).toBe('1 item');
    expect(quickCountLabel([item(), item()])).toBe('2 items');
  });
});
