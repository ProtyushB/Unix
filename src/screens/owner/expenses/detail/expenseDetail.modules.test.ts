import { configFor, moduleLabel } from './expenseDetail.modules';

describe('configFor', () => {
  it('resolves both modules, case-insensitively', () => {
    expect(configFor('PARLOUR').moduleKey).toBe('PARLOUR');
    expect(configFor('pharmacy').moduleKey).toBe('PHARMACY');
    expect(moduleLabel('PARLOUR')).toBe('Parlour');
    expect(moduleLabel('PHARMACY')).toBe('Pharmacy');
  });

  it('defaults to parlour rather than throwing on a blank key', () => {
    // `selectedModule` comes from app context and can be momentarily empty while switching; a
    // detail screen still has to render.
    expect(configFor(null).moduleKey).toBe('PARLOUR');
    expect(configFor(undefined).moduleKey).toBe('PARLOUR');
    expect(configFor('').moduleKey).toBe('PARLOUR');
    expect(configFor('RESTAURANT').moduleKey).toBe('PARLOUR');
  });

  it('declares NO divergence between the two — the tripwire', () => {
    // An expense is a non-inventory outflow: it names no product, touches no batch and reads no
    // ladder, so the two modules have nothing to disagree about. If a real difference ever appears,
    // this assertion fails and points at the file that should carry it.
    expect(configFor('PARLOUR').extraFields).toEqual([]);
    expect(configFor('PHARMACY').extraFields).toEqual([]);
  });
});
