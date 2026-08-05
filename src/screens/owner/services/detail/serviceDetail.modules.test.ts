import { toFormState } from './serviceDetail.model';
import {
  PARLOUR_SERVICE_CONFIG,
  PHARMACY_SERVICE_CONFIG,
  configFor,
  primaryFieldKey,
} from './serviceDetail.modules';

describe('configFor', () => {
  it('dispatches on the module key', () => {
    expect(configFor('PHARMACY')).toBe(PHARMACY_SERVICE_CONFIG);
    expect(configFor('PARLOUR')).toBe(PARLOUR_SERVICE_CONFIG);
  });

  it('falls back to parlour for an unknown module', () => {
    expect(configFor('RESTAURANT')).toBe(PARLOUR_SERVICE_CONFIG);
    expect(configFor('')).toBe(PARLOUR_SERVICE_CONFIG);
  });
});

describe.each([
  ['parlour', PARLOUR_SERVICE_CONFIG],
  ['pharmacy', PHARMACY_SERVICE_CONFIG],
])('%s config', (_label, config) => {
  it('defaults exactly the fields it declares', () => {
    expect(Object.keys(config.extraDefaults).sort()).toEqual([...config.extraFields].sort());
  });

  it('seeds a form with every declared field', () => {
    const form = toFormState({}, config.extraFields);
    for (const key of config.extraFields) expect(form.extras).toHaveProperty(key);
  });

  it('leaves categoryIds out, so it rides the server DTO untouched', () => {
    // Listing it here would make it form state, and form state overwrites the server value on
    // save — which for categories means clearing whatever the web portal set.
    expect(config.extraFields).not.toContain('categoryIds');
  });

  it('has no module rules today', () => {
    expect(config.validate(toFormState({}, config.extraFields))).toEqual({});
  });
});

describe('pharmacy config', () => {
  it('leaves requirements out — no mobile UI, so it must round-trip untouched', () => {
    // `requirements` is what the CUSTOMER brings; `equipmentRequired` is what the service is
    // performed with. Only the latter is rendered, so only the latter is form state.
    expect(PHARMACY_SERVICE_CONFIG.extraFields).not.toContain('requirements');
    expect(PHARMACY_SERVICE_CONFIG.extraFields).toContain('equipmentRequired');
  });
});

describe('primaryFieldKey', () => {
  it('names the field each module puts beside the service name', () => {
    expect(primaryFieldKey(PARLOUR_SERVICE_CONFIG)).toBe('expertiseLevel');
    expect(primaryFieldKey(PHARMACY_SERVICE_CONFIG)).toBe('consultationType');
  });

  it('names a field the module actually declares', () => {
    for (const config of [PARLOUR_SERVICE_CONFIG, PHARMACY_SERVICE_CONFIG]) {
      expect(config.extraFields).toContain(primaryFieldKey(config));
    }
  });
});
