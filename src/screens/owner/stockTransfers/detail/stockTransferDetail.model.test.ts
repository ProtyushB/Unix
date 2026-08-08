import {
  buildCreatePayload,
  emptyForm,
  toFormState,
  type StockTransferFormState,
} from './stockTransferDetail.model';

describe('emptyForm', () => {
  it('starts on a CROSS-pool pair — a same-pool transfer moves nothing', () => {
    const form = emptyForm();
    expect(form.sourceType).not.toBe(form.destType);
  });

  it('starts with a reason CONSISTENT with that direction', () => {
    // `PRODUCT_TO_RAW` with sourceType RAW_INVENTORY is accepted by the server and is a lie in the
    // audit log — so the two must never start out of step either.
    const form = emptyForm();
    expect(form.sourceType).toBe('PRODUCT_INVENTORY');
    expect(form.destType).toBe('RAW_INVENTORY');
    expect(form.reason).toBe('PRODUCT_TO_RAW');
  });

  it('leaves the timestamp EMPTY so the server stamps it', () => {
    expect(emptyForm().transferredAt).toBe('');
  });
});

describe('toFormState', () => {
  it('carries both ends through', () => {
    const form = toFormState({
      sourceType: 'RAW_INVENTORY',
      destType: 'PRODUCT_INVENTORY',
      reason: 'RAW_TO_PRODUCT',
    });
    expect(form.sourceType).toBe('RAW_INVENTORY');
    expect(form.destType).toBe('PRODUCT_INVENTORY');
  });

  it('finds no unit rows on a saved record, because the server discarded them', () => {
    // Which is why the read view renders through `recordQtyLabel` rather than from the rows.
    expect(toFormState({ quantity: 700, unitName: 'ml' }).unitRows).toEqual([]);
  });

  it('falls back to a blank form for a null record', () => {
    expect(toFormState(null)).toEqual(emptyForm());
  });
});

describe('buildCreatePayload', () => {
  /** The form as the screen would hand it over, plus the batch the source pool resolved to. */
  const build = (over: Partial<StockTransferFormState> = {}, batchId: number | null = 41) =>
    buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }],
        ...over,
      },
      7,
      batchId,
    );

  it('sends the SCALAR shape, which is all a clamped-to-one form can produce', () => {
    expect(build({ unitRows: [{ unit: 'bottle', perStock: 500, qty: 2 }] })).toMatchObject({
      businessId: 7,
      quantity: 2,
      unitName: 'bottle',
      unitMultiplier: 500,
    });
  });

  it('is addressed by the SOURCE BATCH, not by a product and a pool', () => {
    // `sourceBatchId` is `@NotNull @Positive`; the controller forwards it as the first argument to
    // `transfer(...)` and derives `itemId` and `sourceType` from the batch it names.
    expect(build({}, 41)?.sourceBatchId).toBe(41);
  });

  it('still sends the DESTINATION pool, which is the one end the server cannot derive', () => {
    expect(build()?.destType).toBe('RAW_INVENTORY');
    expect(
      build({ sourceType: 'RAW_INVENTORY', destType: 'PRODUCT_INVENTORY' })?.destType,
    ).toBe('PRODUCT_INVENTORY');
  });

  it('sends exactly the keys the controller reads, and no others', () => {
    // 12 of the DTO's 20 fields are ignored server-side. Sending one that is dropped is not free —
    // it reads as a promise the record does not keep the next time someone opens this file.
    expect(Object.keys(build()!).sort()).toEqual(
      [
        'businessId',
        'destType',
        'notes',
        'quantity',
        'reason',
        'sourceBatchId',
        'unitMultiplier',
        'unitName',
      ].sort(),
    );
  });

  it('omits the five fields the server derives or ignores, and never emits `unitLines`', () => {
    /*
      The whole point of the corrected payload, pinned key by key:

        itemId / itemName / sourceType — derived from `sourceBatchId`. The FORM still holds all
            three (it needs `sourceType` to decide which batch this is); it just stops sending them.
        transferredAt — ignored; the server stamps the row itself.
        unitLines — ignored, and now has no key on the type at all, so a breakdown cannot be sent
            even by accident. That is what `allowMultiple={false}` on `UnitRowsEditor` protects: with
            one row `deriveUnitLinesPayload` can only take the scalar branch.
    */
    const entries = [
      [{ unit: 'ml', perStock: 1, qty: 200 }],
      [{ unit: 'bottle', perStock: 500, qty: 2 }],
      // Even if a second row somehow reached the builder, no breakdown may reach the wire.
      [
        { unit: 'bottle', perStock: 500, qty: 1 },
        { unit: 'ml', perStock: 1, qty: 8 },
      ],
    ];
    for (const unitRows of entries) {
      const keys = Object.keys(build({ unitRows })!);
      for (const dropped of ['itemId', 'itemName', 'sourceType', 'transferredAt', 'unitLines']) {
        expect(keys).not.toContain(dropped);
      }
    }
  });

  it('keeps the form holding `sourceType` even though the payload drops it', () => {
    // The direction control, the picker helper and the over-draw ceiling all read it. Dropping it
    // from the FORM as well as the payload would take the form's own direction logic with it.
    const form = { ...emptyForm(), sourceType: 'RAW_INVENTORY' as const };
    expect(form.sourceType).toBe('RAW_INVENTORY');
    expect(Object.keys(build({ sourceType: 'RAW_INVENTORY' })!)).not.toContain('sourceType');
  });

  it('sends null, never an empty string, for an untouched note', () => {
    // A whitespace-only note is not a note, and the server stores `''` as one.
    expect(build()?.notes).toBeNull();
    expect(build({ notes: '  opened for treatments  ' })?.notes).toBe('opened for treatments');
  });

  it('is null when nothing is entered, so the caller fails validation instead of posting a zero', () => {
    expect(build({ unitRows: [] })).toBeNull();
    expect(build({ unitRows: [{ unit: 'ml', perStock: 1, qty: 0 }] })).toBeNull();
  });

  it('is null when no source batch resolved, rather than posting a body that is a 400', () => {
    // Without `sourceBatchId` the body fails bean validation, and the 400 names a field this form
    // never showed anyone — there is no batch picker to send the user back to.
    expect(build({}, null)).toBeNull();
  });
});
