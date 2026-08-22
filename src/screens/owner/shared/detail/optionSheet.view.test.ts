import { filterSheetOptions, noOptionMatchText, statusSheetOptions } from './optionSheet.view';
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

describe('statusSheetOptions', () => {
  const TONES: Record<string, { text: string }> = {
    PENDING: { text: '#93a0b0' },
    CONFIRMED: { text: '#fbbf24' },
    COMPLETED: { text: '#34d399' },
  };
  const colorOf = (s: string) => TONES[s] ?? { text: '#64748b' };
  const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

  it('gives every option the tone colour for BOTH its dot and its label', () => {
    const [pending, confirmed] = statusSheetOptions(['PENDING', 'CONFIRMED'], { label, colorOf });
    // Both read from the same StatusColorSet the chips use, so a sheet cannot drift from the chip
    // it produces. The dot takes `text`, not `bg` -- the wash is near-invisible at 8px.
    expect(pending).toEqual({
      value: 'PENDING',
      label: 'Pending',
      sub: undefined,
      dotColor: '#93a0b0',
      textColor: '#93a0b0',
    });
    expect(confirmed.dotColor).toBe('#fbbf24');
    expect(confirmed.textColor).toBe('#fbbf24');
  });

  it('keeps the caller order rather than grouping by tone', () => {
    // The sheet lists a lifecycle; sorting it by colour would scramble the order a reader expects.
    expect(
      statusSheetOptions(['COMPLETED', 'PENDING', 'CONFIRMED'], { label, colorOf }).map(
        (o) => o.value,
      ),
    ).toEqual(['COMPLETED', 'PENDING', 'CONFIRMED']);
  });

  it('falls back rather than throwing on a status the theme has no tone for', () => {
    // The server can invent a status; a sheet that crashes is worse than one drawn slate.
    const [only] = statusSheetOptions(['INVENTED'], { label, colorOf });
    expect(only.textColor).toBe('#64748b');
    expect(only.label).toBe('Invented');
  });

  it('applies sub only where the caller returns one', () => {
    const out = statusSheetOptions(['PENDING', 'CONFIRMED'], {
      label,
      colorOf,
      sub: (s) => (s === 'CONFIRMED' ? 'Tells the customer it is on' : undefined),
    });
    expect(out[0].sub).toBeUndefined();
    expect(out[1].sub).toBe('Tells the customer it is on');
  });
});
