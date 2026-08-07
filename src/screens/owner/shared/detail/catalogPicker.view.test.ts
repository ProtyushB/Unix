import {
  activePicks,
  createNewA11yLabel,
  createNewLabel,
  shouldResumeCatalogPick,
  shouldStartCreateNav,
  showsCreateNew,
  togglePick,
} from './catalogPicker.view';

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
