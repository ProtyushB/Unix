import {
  DERIVED_KEYS,
  addPack,
  buildCreatePayload,
  formatLadderSummary,
  formatPackLevel,
  needsFolder,
  packLevelLabel,
  priceWithUnit,
  productFiles,
  readLadder,
  removePack,
  removedFiles,
  stockLine,
  toFormState,
  toIntOrNull,
  toNumberOrNull,
  toUpdatePayload,
  updatePack,
  writeLadder,
  type PackLevel,
} from './productDetail.model';
import { PARLOUR_PRODUCT_CONFIG, PHARMACY_PRODUCT_CONFIG } from './productDetail.modules';

const pack = (over: Partial<PackLevel> = {}): PackLevel => ({
  unit: 'Box',
  perStock: '20',
  price: '520',
  ...over,
});

describe('toNumberOrNull / toIntOrNull', () => {
  it('treats an empty box as "not set" rather than zero', () => {
    // volume is Integer @PositiveOrZero server-side: '' is a 400 and 0 is a lie.
    expect(toNumberOrNull('')).toBeNull();
    expect(toIntOrNull('')).toBeNull();
    expect(toIntOrNull('   ')).toBeNull();
  });

  it('keeps a real zero', () => {
    expect(toNumberOrNull('0')).toBe(0);
    expect(toIntOrNull(0)).toBe(0);
  });

  it('rejects junk instead of producing NaN', () => {
    expect(toNumberOrNull('abc')).toBeNull();
  });

  it('truncates rather than rounds, since the column is an integer', () => {
    expect(toIntOrNull('20.9')).toBe(20);
  });
});

describe('readLadder', () => {
  it('drops the base row and keeps the packs', () => {
    const { packs } = readLadder([
      { unit: 'tablet', perStock: 1, price: 5 },
      { unit: 'Strip', perStock: 10, price: 45 },
    ]);
    expect(packs).toEqual([{ unit: 'Strip', perStock: '10', price: '45' }]);
  });

  it('keeps a pack whose perStock is momentarily 1', () => {
    // The bug this prevents: a user clearing "10" to type "20" passes through 1. Filtering packs
    // by perStock > 1 rather than by position makes the row they are editing disappear.
    const { packs } = readLadder([
      { unit: 'tablet', perStock: 1, price: 5 },
      { unit: 'Strip', perStock: 1, price: 45 },
    ]);
    expect(packs).toHaveLength(1);
    expect(packs[0].unit).toBe('Strip');
  });

  it('treats a list with no base row as all packs', () => {
    const { packs } = readLadder([{ unit: 'Strip', perStock: 10, price: 45 }]);
    expect(packs).toHaveLength(1);
  });

  it('survives null and non-array input', () => {
    expect(readLadder(null).packs).toEqual([]);
    expect(readLadder(undefined).packs).toEqual([]);
    expect(readLadder('nonsense').packs).toEqual([]);
  });
});

describe('writeLadder', () => {
  it('always emits the base row first, with perStock 1', () => {
    const out = writeLadder('tablet', '5', []);
    expect(out).toEqual([{ unit: 'tablet', perStock: 1, price: 5 }]);
  });

  it('emits a blank base row rather than dropping it', () => {
    // Blank is left blank on purpose so validation can flag it. Dropping the row instead would let
    // the server invent a base unit the user never chose.
    const out = writeLadder('', '', []);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ unit: '', perStock: 1, price: null });
  });

  it('round-trips through readLadder', () => {
    const packs = [pack(), pack({ unit: 'Case', perStock: '200', price: '4800' })];
    expect(readLadder(writeLadder('tablet', '5', packs)).packs).toEqual(packs);
  });
});

describe('pack helpers', () => {
  it('adds a blank level', () => {
    expect(addPack([])).toEqual([{ unit: '', perStock: '', price: '' }]);
  });

  it('removes by index without touching its neighbours', () => {
    const packs = [pack({ unit: 'A' }), pack({ unit: 'B' }), pack({ unit: 'C' })];
    expect(removePack(packs, 1).map((p) => p.unit)).toEqual(['A', 'C']);
  });

  it('updates one field of one row', () => {
    const packs = [pack({ unit: 'A' }), pack({ unit: 'B' })];
    const out = updatePack(packs, 1, 'perStock', '99');
    expect(out[1].perStock).toBe('99');
    expect(out[1].unit).toBe('B');
    expect(out[0]).toEqual(packs[0]);
  });

  it('numbers levels from 2, because the base is never a level', () => {
    expect(packLevelLabel(0)).toBe('2nd level');
    expect(packLevelLabel(1)).toBe('3rd level');
    expect(packLevelLabel(2)).toBe('4th level');
  });
});

describe('formatting', () => {
  it('renders a pack level with its multiplier and price', () => {
    expect(formatPackLevel({ unit: 'Box', perStock: 20, price: 520 })).toBe('Box ×20 · ₹520');
  });

  it('omits the price when there is none', () => {
    expect(formatPackLevel({ unit: 'Box', perStock: 20, price: null })).toBe('Box ×20');
  });

  it('says None when a product has no pack levels', () => {
    expect(formatLadderSummary([{ unit: 'tablet', perStock: 1, price: 5 }])).toBe('None');
    expect(formatLadderSummary(null)).toBe('None');
  });

  it('pluralises the stock line but leaves a single unit alone', () => {
    expect(stockLine(42, 'piece')).toBe('42 pieces');
    expect(stockLine(1, 'piece')).toBe('1 piece');
  });

  it('renders nothing for a null quantity', () => {
    // Null means "not counted" — untracked, or the Inventory tab is off. Rendering "0 pieces"
    // there tells the user the shelf is empty when nobody ever counted it.
    expect(stockLine(null, 'piece')).toBe('');
    expect(stockLine(undefined, 'piece')).toBe('');
    expect(stockLine(0, 'piece')).toBe('0 pieces');
  });

  it('falls back to a bare price when the product has no stock unit', () => {
    expect(priceWithUnit(349, 'tablet')).toBe('₹349 / tablet');
    expect(priceWithUnit(349, '')).toBe('₹349');
  });
});

describe('toFormState', () => {
  it('defaults isOrderRequired to true when absent, matching @ColumnDefault', () => {
    expect(toFormState({}).isOrderRequired).toBe(true);
    expect(toFormState({ isOrderRequired: false }).isOrderRequired).toBe(false);
  });

  it('only treats an explicit true as tracked', () => {
    expect(toFormState({}).trackInventory).toBe(false);
    expect(toFormState({ trackInventory: true }).trackInventory).toBe(true);
  });

  it('pulls the module fields into extras and leaves absent ones null', () => {
    const form = toFormState({ skinType: 'Oily' }, PARLOUR_PRODUCT_CONFIG.extraFields);
    expect(form.extras.skinType).toBe('Oily');
    expect(form.extras.isOrganic).toBeNull();
  });

  it('keeps a zero price distinguishable from an unset one', () => {
    expect(toFormState({ price: 0 }).price).toBe('0');
    expect(toFormState({}).price).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The payload round-trip. PUT /{module}Product is a FULL-OBJECT replace, so any key the form
// forgets to carry is not "left alone" — the server erases it. These are the tests that fail the
// day someone adds a column and forgets the form.
// ─────────────────────────────────────────────────────────────────────────────

function fixture(extra: Record<string, unknown>) {
  return {
    id: 7,
    businessId: 200,
    name: 'Aloe Vera Face Wash',
    description: 'Gentle cleanser',
    price: 349,
    brand: 'Lotus',
    manufacturer: 'Lotus Herbals',
    volume: 250,
    volumeUnit: 'ml',
    packagingType: 'Pump bottle',
    stockUnit: 'piece',
    saleUnits: [{ unit: 'piece', perStock: 1, price: 349 }],
    safetyWarning: 'External use only',
    productType: 'NORMAL',
    comboType: null,
    comboItems: [],
    trackInventory: true,
    isOrderRequired: true,
    dmsFolderId: 55,
    files: [{ dmsFileId: 1 }],
    categoryIds: [3, 9],
    // Server-derived — must NOT be echoed back on a write.
    availability: true,
    availableQuantity: 42,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    categorySet: null,
    ...extra,
  };
}

describe.each([
  [
    'parlour',
    PARLOUR_PRODUCT_CONFIG,
    {
      skinType: 'Oily',
      usage: 'Daily',
      applicationMethod: 'Massage',
      ingredients: 'Aloe',
      isOrganic: true,
      isCrueltyFree: false,
    },
  ],
  [
    'pharmacy',
    PHARMACY_PRODUCT_CONFIG,
    {
      genericName: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '500 mg',
      routeOfAdministration: 'Oral',
      storageConditions: 'Cool',
      isPrescriptionRequired: true,
      isOTC: false,
    },
  ],
])('toUpdatePayload — %s loses no field', (_label, config, extras) => {
  const item = fixture(extras);
  const form = toFormState(item, config.extraFields);
  const payload = toUpdatePayload(item, form, item.files, item.dmsFolderId);

  it('carries every key the server sent except the derived ones', () => {
    const expected = Object.keys(item)
      .filter((k) => !(DERIVED_KEYS as readonly string[]).includes(k))
      .sort();
    expect(Object.keys(payload).sort()).toEqual(expected);
  });

  it('strips the derived keys so the server recomputes them', () => {
    for (const key of DERIVED_KEYS) expect(payload).not.toHaveProperty(key);
  });

  it('round-trips every value untouched when nothing was edited', () => {
    for (const key of Object.keys(payload)) {
      expect({ [key]: payload[key] }).toEqual({ [key]: (item as Record<string, unknown>)[key] });
    }
  });

  it('keeps trackInventory, which is a primitive boolean server-side', () => {
    // Omit it and Jackson defaults it to false: setTrackInventory runs unconditionally on update,
    // so a save from this form would silently untrack a tracked product.
    expect(payload.trackInventory).toBe(true);
  });

  it('echoes categoryIds even though there is no category UI', () => {
    // The update reads categories off the incoming entity, so omitting this clears whatever the
    // web portal set. Dropped from the UI must not mean dropped from the wire.
    expect(payload.categoryIds).toEqual([3, 9]);
  });

  it('keeps files, since omitting them unlinks every image', () => {
    expect(payload.files).toEqual([{ dmsFileId: 1 }]);
  });
});

describe('toUpdatePayload — edits', () => {
  it('overlays the edited field and leaves the rest of the record alone', () => {
    const item = fixture({});
    const form = { ...toFormState(item), name: 'Renamed' };
    const payload = toUpdatePayload(item, form, item.files, item.dmsFolderId);
    expect(payload.name).toBe('Renamed');
    expect(payload.brand).toBe('Lotus');
    expect(payload.safetyWarning).toBe('External use only');
  });

  it('sends null rather than empty string for a cleared volume', () => {
    const item = fixture({});
    const form = { ...toFormState(item), volume: '' };
    expect(toUpdatePayload(item, form, [], null).volume).toBeNull();
  });

  it('keeps the existing folder when no new one was created', () => {
    // A null folder argument means "this save did not make a folder", not "delete the one you
    // have". Overwriting it with null would orphan every image already in DMS.
    const item = fixture({});
    expect(toUpdatePayload(item, toFormState(item), [], null).dmsFolderId).toBe(55);
  });

  it('adopts a newly created folder', () => {
    const item = fixture({ dmsFolderId: null });
    expect(toUpdatePayload(item, toFormState(item), [], 77).dmsFolderId).toBe(77);
  });
});

describe('image helpers', () => {
  it('reads files off a record and tolerates one with none', () => {
    expect(productFiles({ files: [{ dmsFileId: 1 }] })).toHaveLength(1);
    expect(productFiles({})).toEqual([]);
    expect(productFiles(null)).toEqual([]);
    expect(productFiles({ files: 'nonsense' })).toEqual([]);
  });

  it('finds what was removed by file id, not by object identity', () => {
    // The form holds copies, so identity comparison would report everything as removed.
    const original = [{ dmsFileId: 1 }, { dmsFileId: 2 }, { dmsFileId: 3 }];
    const kept = [{ dmsFileId: 1 }, { dmsFileId: 3 }];
    expect(removedFiles(original, kept).map((f) => f.dmsFileId)).toEqual([2]);
  });

  it('reports nothing removed when everything was kept', () => {
    const original = [{ dmsFileId: 1 }];
    expect(removedFiles(original, [{ dmsFileId: 1 }])).toEqual([]);
  });

  it('ignores entries with no id, which cannot be deleted server-side anyway', () => {
    expect(removedFiles([{ fileName: 'local.jpg' }], [])).toEqual([]);
  });

  it('asks for a folder only when one is needed', () => {
    // Uploading with no folder yet.
    expect(needsFolder(null, 2, false)).toBe(true);
    // Nothing to upload and no rename — leave DMS alone.
    expect(needsFolder(null, 0, false)).toBe(false);
    // A rename must be pushed: the backend names the folder {name}_{id}, so it would drift.
    expect(needsFolder(55, 0, true)).toBe(true);
    // Uploading into a folder that already exists and still has the right name.
    expect(needsFolder(55, 2, false)).toBe(false);
  });
});

describe('buildCreatePayload', () => {
  it('carries no id and starts with an empty file list', () => {
    const form = toFormState({}, PARLOUR_PRODUCT_CONFIG.extraFields);
    const payload = buildCreatePayload(form, 200, PARLOUR_PRODUCT_CONFIG.extraDefaults);
    expect(payload).not.toHaveProperty('id');
    expect(payload.businessId).toBe(200);
    expect(payload.files).toEqual([]);
    expect(payload.productType).toBe('NORMAL');
  });

  it('fills a module default rather than posting the null the form was seeded with', () => {
    // toFormState on an empty record sets every module field to null. Spreading the defaults UNDER
    // the form would let those nulls win, and a new pharmacy product would post isOTC: null.
    const form = toFormState({}, PHARMACY_PRODUCT_CONFIG.extraFields);
    expect(form.extras.isOTC).toBeNull();

    const payload = buildCreatePayload(form, 200, PHARMACY_PRODUCT_CONFIG.extraDefaults);
    expect(payload.isOTC).toBe(true);
    expect(payload.isPrescriptionRequired).toBe(false);
  });

  it('lets a real form value beat the default', () => {
    const form = toFormState({}, PHARMACY_PRODUCT_CONFIG.extraFields);
    form.extras.isOTC = false;
    expect(buildCreatePayload(form, 200, PHARMACY_PRODUCT_CONFIG.extraDefaults).isOTC).toBe(false);
  });
});
