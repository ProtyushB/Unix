import { configFor, moduleLabel } from './stockTransferDetail.modules';

describe('configFor', () => {
  it('resolves the two real modules', () => {
    expect(configFor('PARLOUR').moduleKey).toBe('PARLOUR');
    expect(configFor('PHARMACY').moduleKey).toBe('PHARMACY');
  });

  it('is case-insensitive, because the key comes from stored session state', () => {
    expect(configFor('pharmacy').moduleKey).toBe('PHARMACY');
  });

  it('falls back to parlour rather than crashing on an unknown key', () => {
    expect(configFor('').moduleKey).toBe('PARLOUR');
    expect(configFor(null).moduleKey).toBe('PARLOUR');
    expect(configFor('RESTAURANT').moduleKey).toBe('PARLOUR');
  });
});

describe('module divergence', () => {
  it('is EMPTY for both modules today, and this test is the tripwire', () => {
    // The two controllers are byte-identical apart from their base path. If someone adds a
    // pharmacy-only transfer field server-side, this fails and points at the form that must follow.
    expect(configFor('PARLOUR').extraFields).toEqual([]);
    expect(configFor('PHARMACY').extraFields).toEqual([]);
  });

  it('keeps any future extra fields disjoint between modules', () => {
    const parlour = new Set(configFor('PARLOUR').extraFields);
    const shared = configFor('PHARMACY').extraFields.filter((f) => parlour.has(f));
    // A field both modules need belongs in the shared form, not in two module configs.
    expect(shared).toEqual([]);
  });
});

describe('moduleLabel', () => {
  it('names the pill in the app bar', () => {
    expect(moduleLabel('PARLOUR')).toBe('Parlour');
    expect(moduleLabel('PHARMACY')).toBe('Pharmacy');
  });
});
