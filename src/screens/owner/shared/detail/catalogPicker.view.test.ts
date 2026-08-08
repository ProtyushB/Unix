import {
  activePicks,
  createNewA11yLabel,
  createNewLabel,
  rowDisabled,
  shouldResumeCatalogPick,
  shouldStartCreateNav,
  showsCreateNew,
  stockTone,
  stockTrailing,
  togglePick,
} from './catalogPicker.view';

describe('stockTrailing', () => {
  it('draws NOTHING for a row that carries no stock slot', () => {
    // The whole basis of the additive claim: batch, order and appointment detail pass no `stock`,
    // so their rows are unchanged. If this ever stops returning null the three shipped pickers grow
    // a column nobody asked for.
    expect(stockTrailing({})).toBeNull();
    expect(stockTrailing({ stock: null })).toBeNull();
  });

  it('draws the total and its breakdown', () => {
    expect(stockTrailing({ stock: { total: '1,530 g', breakdown: '3 tubs · 30 g' } })).toEqual({
      total: '1,530 g',
      sub: '3 tubs · 30 g',
    });
  });

  it('draws the total alone when the breakdown would just repeat it', () => {
    expect(stockTrailing({ stock: { total: '6 rolls' } })).toEqual({ total: '6 rolls', sub: null });
    expect(stockTrailing({ stock: { total: '6 rolls', breakdown: null } })).toEqual({
      total: '6 rolls',
      sub: null,
    });
  });

  it('lets a disabledNote REPLACE the breakdown', () => {
    // "0 tubs" is true, useless, and occupies the line that should explain why the row is inert.
    expect(
      stockTrailing({
        stock: { total: '0 ml', breakdown: '0 bottles' },
        disabledNote: 'no raw stock',
      }),
    ).toEqual({ total: '0 ml', sub: 'no raw stock' });
  });

  it('ignores a note on a row with no stock slot at all', () => {
    expect(stockTrailing({ disabledNote: 'no raw stock' })).toBeNull();
  });
});

describe('rowDisabled', () => {
  it('reduces to the already-added check when no caller sets `disabled`', () => {
    // Which is exactly the behaviour the three shipped pickers had before the stock slot existed.
    expect(rowDisabled({ alreadyAdded: true })).toBe(true);
    expect(rowDisabled({ alreadyAdded: false })).toBe(false);
  });

  it('is inert for either reason — "you already have this" and "there is none" both block', () => {
    expect(rowDisabled({ alreadyAdded: false, disabled: true })).toBe(true);
    expect(rowDisabled({ alreadyAdded: true, disabled: false })).toBe(true);
  });
});

describe('stockTone', () => {
  it('is red only when the row is disabled', () => {
    // Keyed off the flag rather than parsed out of "0 ml", which would break the moment a locale
    // formats the number differently.
    expect(stockTone({ disabled: true })).toBe('error');
    expect(stockTone({ disabled: false })).toBe('success');
    expect(stockTone({})).toBe('success');
  });
});

describe('showsCreateNew', () => {
  it('is gated on the callback and nothing else', () => {
    // Same gate as Centrix's shared ProductPickerField: a picker that has nowhere useful to send
    // "new" simply does not pass one, so the pill cannot appear where it would dead-end.
    expect(showsCreateNew(() => {})).toBe(true);
    expect(showsCreateNew(undefined)).toBe(false);
    expect(showsCreateNew(null)).toBe(false);
  });
});

describe('createNewLabel', () => {
  it('builds the label from the sheet s own noun', () => {
    // Derived, not passed — otherwise a caller could label the pill "New item" while its footer
    // button, built from the same noun, says "Add 2 products".
    expect(createNewLabel('product')).toBe('New Product');
    expect(createNewLabel('service')).toBe('New Service');
  });

  it('title-cases only the first letter, leaving the rest alone', () => {
    expect(createNewLabel('raw material')).toBe('New Raw material');
    expect(createNewLabel('Product')).toBe('New Product');
  });

  it('falls back to a bare New rather than rendering a trailing space', () => {
    expect(createNewLabel('')).toBe('New');
    expect(createNewLabel('   ')).toBe('New');
  });
});

describe('createNewA11yLabel', () => {
  it('leads with the verb, so it does not sound like the back button', () => {
    // The chevron announces "Close select product". Both controls are in the same bar and both
    // would start with the word the listener is waiting for if this just repeated the label.
    expect(createNewA11yLabel('product')).toBe('Create new product');
    expect(createNewA11yLabel('product')).not.toBe(createNewLabel('product'));
  });

  it('is lowercase regardless of how the caller cased the noun', () => {
    expect(createNewA11yLabel('Product')).toBe('Create new product');
  });

  it('survives an empty noun', () => {
    expect(createNewA11yLabel('')).toBe('Create new');
  });
});

describe('togglePick', () => {
  it('adds at the end and removes in place', () => {
    expect(togglePick([], 3)).toEqual([3]);
    expect(togglePick([3], 7)).toEqual([3, 7]);
    expect(togglePick([3, 7], 3)).toEqual([7]);
  });

  it('keeps the order things were ticked in', () => {
    // The footer counts these and onAdd emits them; a reshuffle would reorder the lines added.
    expect(togglePick(togglePick(togglePick([], 9), 4), 6)).toEqual([9, 4, 6]);
  });

  it('does not mutate the array it was given', () => {
    const ids = [1, 2];
    togglePick(ids, 3);
    expect(ids).toEqual([1, 2]);
  });
});

describe('activePicks', () => {
  it('drops a tick that got committed while the user was away', () => {
    // The selection now outlives the sheet, so this really can happen: tick 3, leave to create a
    // 4th, come back with one of the 3 already on the record.
    expect(activePicks([1, 2, 3], [2])).toEqual([1, 3]);
  });

  it('leaves an untouched selection exactly as it was', () => {
    expect(activePicks([1, 2, 3], [])).toEqual([1, 2, 3]);
    expect(activePicks([], [4])).toEqual([]);
  });

  it('preserves order among the survivors', () => {
    expect(activePicks([9, 4, 6], [4])).toEqual([9, 6]);
  });
});

describe('shouldStartCreateNav', () => {
  it('waits for the sheet to be down before pushing', () => {
    // A native push that lands while the Modal is up goes UNDERNEATH it.
    expect(shouldStartCreateNav({ pendingCreate: true, sheetOpen: true })).toBe(false);
    expect(shouldStartCreateNav({ pendingCreate: true, sheetOpen: false })).toBe(true);
  });

  it('does nothing when no create was asked for', () => {
    expect(shouldStartCreateNav({ pendingCreate: false, sheetOpen: false })).toBe(false);
  });
});

describe('shouldResumeCatalogPick', () => {
  it('reopens the picker only on a return, never on the mount-time focus', () => {
    expect(shouldResumeCatalogPick({ awaiting: true, isFirstFocus: false })).toBe(true);
    expect(shouldResumeCatalogPick({ awaiting: true, isFirstFocus: true })).toBe(false);
  });

  it('stays out of the way of an ordinary return', () => {
    expect(shouldResumeCatalogPick({ awaiting: false, isFirstFocus: false })).toBe(false);
  });
});
