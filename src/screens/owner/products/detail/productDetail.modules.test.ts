import { toFormState } from './productDetail.model';
import {
  PARLOUR_PRODUCT_CONFIG,
  PHARMACY_PRODUCT_CONFIG,
  configFor,
  setDispensing,
} from './productDetail.modules';
import { hasErrors } from './productDetail.view';

describe('configFor', () => {
  it('picks pharmacy only on an exact match, and falls back to parlour', () => {
    expect(configFor('PHARMACY')).toBe(PHARMACY_PRODUCT_CONFIG);
    expect(configFor('PARLOUR')).toBe(PARLOUR_PRODUCT_CONFIG);
    // Same two-way fallback the list screens use — there is no third module.
    expect(configFor('')).toBe(PARLOUR_PRODUCT_CONFIG);
    expect(configFor('RESTAURANT')).toBe(PARLOUR_PRODUCT_CONFIG);
  });
});

describe('field lists', () => {
  it('gives every module field a default, so add mode never posts an undefined', () => {
    for (const config of [PARLOUR_PRODUCT_CONFIG, PHARMACY_PRODUCT_CONFIG]) {
      for (const field of config.extraFields) {
        expect(config.extraDefaults).toHaveProperty(field);
      }
    }
  });

  it('keeps the two modules disjoint', () => {
    // A field on both belongs in the generic layer, not in a module binding.
    const shared = PARLOUR_PRODUCT_CONFIG.extraFields.filter((f) =>
      (PHARMACY_PRODUCT_CONFIG.extraFields as readonly string[]).includes(f),
    );
    expect(shared).toEqual([]);
  });
});

describe('setDispensing', () => {
  it('writes both columns as one choice', () => {
    // isPrescriptionRequired and isOTC are two columns expressing a single decision. Written
    // independently they can contradict each other, and no screen can render that.
    expect(setDispensing({}, true)).toEqual({ isPrescriptionRequired: true, isOTC: false });
    expect(setDispensing({}, false)).toEqual({ isPrescriptionRequired: false, isOTC: true });
  });

  it('leaves the rest of extras alone', () => {
    expect(setDispensing({ strength: '500 mg' }, true).strength).toBe('500 mg');
  });
});

describe('pharmacy validate', () => {
  const form = (extras: Record<string, unknown>) => ({
    ...toFormState({}, PHARMACY_PRODUCT_CONFIG.extraFields),
    extras,
  });

  it('rejects a product that claims to be both Rx and over the counter', () => {
    const errors = PHARMACY_PRODUCT_CONFIG.validate(
      form({ isPrescriptionRequired: true, isOTC: true }),
    );
    expect(errors.dispensing).toBeTruthy();
  });

  it('accepts either side of the pair', () => {
    expect(hasErrors(PHARMACY_PRODUCT_CONFIG.validate(form(setDispensing({}, true))))).toBe(false);
    expect(hasErrors(PHARMACY_PRODUCT_CONFIG.validate(form(setDispensing({}, false))))).toBe(false);
  });
});

describe('parlour validate', () => {
  it('adds no rules of its own — its extras are all free text and independent flags', () => {
    const form = toFormState({}, PARLOUR_PRODUCT_CONFIG.extraFields);
    expect(hasErrors(PARLOUR_PRODUCT_CONFIG.validate(form))).toBe(false);
  });
});
