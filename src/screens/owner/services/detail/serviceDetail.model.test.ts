import {
  DERIVED_KEYS,
  buildCreatePayload,
  filterProductOptions,
  normalizeRequiredProductIds,
  resolveProductName,
  toFormState,
  toProductOptions,
  toUpdatePayload,
  toggleProductId,
  type ServiceDetailItem,
} from './serviceDetail.model';
import {
  PARLOUR_SERVICE_CONFIG,
  PHARMACY_SERVICE_CONFIG,
  type ServiceModuleConfig,
} from './serviceDetail.modules';

/**
 * A DTO with every key the module can carry, each holding a sentinel. The round-trip test below
 * asserts that a save with nothing edited returns all of them unchanged, so a field added to the
 * config without being threaded through fails on the day it is added rather than in production.
 */
const parlourItem: ServiceDetailItem = {
  id: 7,
  businessId: 3,
  name: 'Bridal Makeup Package',
  description: 'Complete bridal makeover with airbrush makeup.',
  price: 15000,
  duration: 180,
  availability: true,
  isAppointmentRequired: true,
  requiredProductIds: [11, 12],
  dmsFolderId: 42,
  files: [{ dmsFileId: 900, url: 'x', fileName: 'a.jpg', fileType: 'image/jpeg', fileSize: 1 }],
  categoryIds: [4, 5],
  categorySet: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  expertiseLevel: 'Premium',
  serviceIncludes: 'Airbrush Makeup, Hairstyling',
  toolsRequired: 'Airbrush Gun, Makeup Kit',
};

const pharmacyItem: ServiceDetailItem = {
  id: 9,
  businessId: 4,
  name: 'Blood Pressure Check',
  description: 'Professional blood-pressure screening.',
  price: 1500,
  duration: 60,
  availability: true,
  isAppointmentRequired: true,
  requiredProductIds: [21],
  dmsFolderId: 43,
  files: [],
  categoryIds: [8],
  categorySet: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  consultationType: 'In-Person',
  serviceIncludes: 'BP Measurement, Reading Log',
  equipmentRequired: 'BP Monitor, Cuff',
  // No mobile UI. Must survive a mobile save untouched.
  requirements: 'Prescription, Insurance card',
};

const cases: Array<[string, ServiceDetailItem, ServiceModuleConfig]> = [
  ['parlour', parlourItem, PARLOUR_SERVICE_CONFIG],
  ['pharmacy', pharmacyItem, PHARMACY_SERVICE_CONFIG],
];

const formFor = (item: ServiceDetailItem, config: ServiceModuleConfig) =>
  toFormState(item, config.extraFields);

describe.each(cases)('%s — toUpdatePayload', (_label, item, config) => {
  const payload = () =>
    toUpdatePayload(
      item,
      formFor(item, config),
      item.files as unknown[],
      item.dmsFolderId as number,
    );

  it('round-trips every key the server sent, minus the derived ones', () => {
    const got = payload();
    const expected = Object.keys(item).filter(
      (k) => !(DERIVED_KEYS as readonly string[]).includes(k),
    );
    expect(Object.keys(got).sort()).toEqual(expected.sort());
    for (const key of expected) expect(got[key]).toEqual(item[key]);
  });

  it('always sends availability, because omitting it is a 500 rather than a false', () => {
    expect(payload()).toHaveProperty('availability', true);
  });

  it('sends availability even when the server DTO never had it', () => {
    // The exact shape a naive `{...serverItem}` spread mishandles: the key is absent, so it stays
    // undefined, JSON.stringify drops it, and the PUT writes NULL into a NOT NULL column.
    const legacy = { ...item };
    delete legacy.availability;
    const got = toUpdatePayload(legacy, formFor(legacy, config), [], null);
    expect(got.availability).toBe(true);
    expect(Object.keys(got)).toContain('availability');
  });

  it('sends availability false when the owner turned it off', () => {
    const form = { ...formFor(item, config), availability: false };
    expect(toUpdatePayload(item, form, [], null).availability).toBe(false);
  });

  it('strips createdAt, updatedAt and categorySet', () => {
    const got = payload();
    expect(got).not.toHaveProperty('createdAt');
    expect(got).not.toHaveProperty('updatedAt');
    expect(got).not.toHaveProperty('categorySet');
  });

  it('echoes categoryIds even though there is no category UI', () => {
    expect(payload().categoryIds).toEqual(item.categoryIds);
  });

  it('sends requiredProductIds even when empty, because omitting it clears them', () => {
    const form = { ...formFor(item, config), requiredProductIds: [] };
    const got = toUpdatePayload(item, form, [], null);
    expect(got.requiredProductIds).toEqual([]);
    expect(Object.keys(got)).toContain('requiredProductIds');
  });

  it('keeps files, since omitting them unlinks every image', () => {
    const files = [{ dmsFileId: 1 }];
    expect(toUpdatePayload(item, formFor(item, config), files, null).files).toEqual(files);
    expect(toUpdatePayload(item, formFor(item, config), [], null).files).toEqual([]);
  });

  it('sends null rather than an empty string for a cleared duration', () => {
    const form = { ...formFor(item, config), duration: '' };
    expect(toUpdatePayload(item, form, [], null).duration).toBeNull();
  });

  it('carries the id in the body, since the PUT has no path variable', () => {
    expect(payload().id).toBe(item.id);
    expect(payload().businessId).toBe(item.businessId);
  });

  it('preserves the folder the server holds when none is passed', () => {
    expect(toUpdatePayload(item, formFor(item, config), [], null).dmsFolderId).toBe(
      item.dmsFolderId,
    );
  });
});

describe('pharmacy — fields with no mobile UI', () => {
  it('echoes requirements, which the screen never renders', () => {
    const form = formFor(pharmacyItem, PHARMACY_SERVICE_CONFIG);
    const got = toUpdatePayload(pharmacyItem, form, [], null);
    expect(got.requirements).toBe('Prescription, Insurance card');
  });

  it('sends equipmentRequired, which is a different column from requirements', () => {
    const form = formFor(pharmacyItem, PHARMACY_SERVICE_CONFIG);
    const got = toUpdatePayload(pharmacyItem, form, [], null);
    expect(got.equipmentRequired).toBe('BP Monitor, Cuff');
    expect(got.equipmentRequired).not.toBe(got.requirements);
  });
});

describe('DERIVED_KEYS', () => {
  it('keeps availability out, because a service stores it rather than deriving it', () => {
    // The product screen lists `availability` here — its value comes from inventory. Copying that
    // list across would make every service save a 500.
    expect(DERIVED_KEYS).not.toContain('availability');
  });

  it('has no availableQuantity, because a service has no stock', () => {
    expect(DERIVED_KEYS).not.toContain('availableQuantity');
  });
});

describe('toFormState', () => {
  it('reads a missing availability as available, matching the column default', () => {
    expect(toFormState({}).availability).toBe(true);
    expect(toFormState({ availability: false }).availability).toBe(false);
  });

  it('reads a missing isAppointmentRequired as true, matching the mapper', () => {
    expect(toFormState({}).isAppointmentRequired).toBe(true);
    expect(toFormState({ isAppointmentRequired: false }).isAppointmentRequired).toBe(false);
  });

  it('leaves a null duration blank rather than showing zero', () => {
    expect(toFormState({ duration: null }).duration).toBe('');
    expect(toFormState({ duration: 60 }).duration).toBe('60');
  });

  it('seeds only the module keys it is given', () => {
    const form = toFormState(pharmacyItem, PHARMACY_SERVICE_CONFIG.extraFields);
    expect(form.extras).toEqual({
      consultationType: 'In-Person',
      serviceIncludes: 'BP Measurement, Reading Log',
      equipmentRequired: 'BP Monitor, Cuff',
    });
    expect(form.extras).not.toHaveProperty('requirements');
  });
});

describe('buildCreatePayload', () => {
  const blank = toFormState({}, PARLOUR_SERVICE_CONFIG.extraFields);

  it('has no id and an empty file list', () => {
    const got = buildCreatePayload(blank, 3, PARLOUR_SERVICE_CONFIG.extraDefaults);
    expect(got).not.toHaveProperty('id');
    expect(got.files).toEqual([]);
    expect(got.businessId).toBe(3);
  });

  it('sends availability, which is required on create too', () => {
    expect(buildCreatePayload(blank, 3).availability).toBe(true);
  });

  it('fills only the gaps a default is for', () => {
    const typed = { ...blank, extras: { ...blank.extras, expertiseLevel: 'Premium' } };
    const got = buildCreatePayload(typed, 3, PARLOUR_SERVICE_CONFIG.extraDefaults);
    expect(got.expertiseLevel).toBe('Premium');
    expect(got.toolsRequired).toBe('');
  });
});

describe('required-product helpers', () => {
  it('survives junk in the jsonb column', () => {
    expect(normalizeRequiredProductIds(null)).toEqual([]);
    expect(normalizeRequiredProductIds('nope')).toEqual([]);
    expect(normalizeRequiredProductIds([1, '2', null, 3.7, 1])).toEqual([1, 2, 3]);
  });

  it('maps product rows to options and names the unnamed', () => {
    expect(toProductOptions([{ id: 1, name: ' Serum ' }, { id: 2 }, { name: 'no id' }])).toEqual([
      { id: 1, name: 'Serum' },
      { id: 2, name: '#2' },
    ]);
  });

  it('falls back to #id, because the jsonb column has no foreign key', () => {
    const options = [{ id: 1, name: 'Serum' }];
    expect(resolveProductName(options, 1)).toBe('Serum');
    expect(resolveProductName(options, 99)).toBe('#99');
  });

  it('filters by name and keeps selected options in the list', () => {
    const options = [
      { id: 1, name: 'Airbrush Foundation' },
      { id: 2, name: 'Setting Spray' },
    ];
    expect(filterProductOptions(options, 'spray')).toEqual([options[1]]);
    expect(filterProductOptions(options, '  ')).toEqual(options);
  });

  it('toggles an id in and out', () => {
    expect(toggleProductId([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleProductId([1, 2], 2)).toEqual([1]);
  });
});
