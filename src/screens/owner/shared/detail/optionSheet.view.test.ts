import { filterSheetOptions, noOptionMatchText } from './optionSheet.view';
import type { SheetOption } from './parts/OptionSheet';

const OPTIONS: SheetOption[] = [
  { value: 'MAINTENANCE_REPAIR', label: 'Maintenance & Repair' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'RENT_LEASE', label: 'Rent / Lease' },
  { value: 'TRANSPORT_FUEL', label: 'Transport & Fuel', sub: 'Fuel, servicing, courier charges' },
];

describe('filterSheetOptions', () => {
  it('returns the SAME array when the query is blank, so an untouched box costs nothing', () => {
    // Reference equality, not just deep equality: a fresh array every render would be a new
    // useEffect/useMemo dependency, which is how this codebase has shipped a render loop before.
    expect(filterSheetOptions(OPTIONS, '')).toBe(OPTIONS);
    expect(filterSheetOptions(OPTIONS, '   ')).toBe(OPTIONS);
    expect(filterSheetOptions(OPTIONS, null)).toBe(OPTIONS);
    expect(filterSheetOptions(OPTIONS, undefined)).toBe(OPTIONS);
  });

  it('matches a case-insensitive substring of the label', () => {
    expect(filterSheetOptions(OPTIONS, 'rent').map((o) => o.value)).toEqual(['RENT_LEASE']);
    expect(filterSheetOptions(OPTIONS, 'UTIL').map((o) => o.value)).toEqual(['UTILITIES']);
    expect(filterSheetOptions(OPTIONS, 'e').length).toBeGreaterThan(1);
  });

  it('trims the query, so a trailing space does not empty the list', () => {
    expect(filterSheetOptions(OPTIONS, '  rent  ').map((o) => o.value)).toEqual(['RENT_LEASE']);
  });

  it('matches inside a label, not only at its start', () => {
    expect(filterSheetOptions(OPTIONS, 'repair').map((o) => o.value)).toEqual([
      'MAINTENANCE_REPAIR',
    ]);
  });

  it('does NOT match the sub line', () => {
    // "courier" appears only in Transport's sub. Matching it would surface an option whose own name
    // has nothing to do with what was typed, and the user cannot tell why it is there.
    expect(filterSheetOptions(OPTIONS, 'courier')).toEqual([]);
  });

  it('does not match the underlying value — the user searches what they can read', () => {
    // Typing "RENT_LEASE" is not something a person does; the enum name is not on screen.
    expect(filterSheetOptions(OPTIONS, 'RENT_LEASE')).toEqual([]);
  });

  it('returns empty rather than everything when nothing matches', () => {
    expect(filterSheetOptions(OPTIONS, 'zzz')).toEqual([]);
  });
});

describe('noOptionMatchText', () => {
  it('quotes the query back, so the user can see it was their typing', () => {
    expect(noOptionMatchText('zzz')).toBe('No match for “zzz”.');
    expect(noOptionMatchText('  rent  ')).toBe('No match for “rent”.');
  });

  it('says something different when there was nothing to search in the first place', () => {
    expect(noOptionMatchText('')).toBe('Nothing to choose from.');
    expect(noOptionMatchText(null)).toBe('Nothing to choose from.');
  });
});
