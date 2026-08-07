import { createNewA11yLabel, createNewLabel, showsCreateNew } from './catalogPicker.view';

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
