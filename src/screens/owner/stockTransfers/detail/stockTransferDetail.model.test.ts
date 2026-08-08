import { buildCreatePayload, emptyForm, toFormState } from './stockTransferDetail.model';

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
  it('sends the SCALAR shape, which is all a clamped-to-one form can produce', () => {
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'bottle', perStock: 500, qty: 2 }] },
      7,
    );
    expect(payload).toMatchObject({
      businessId: 7,
      itemId: 21,
      quantity: 2,
      unitName: 'bottle',
      unitMultiplier: 500,
      unitLines: null,
    });
  });

  it('carries BOTH pools, and they differ', () => {
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }] },
      7,
    );
    expect(payload?.sourceType).not.toBe(payload?.destType);
  });

  it('never sends a breakdown, because the server would discard one', () => {
    // The rows are clamped to one upstream; this pins the consequence at the payload.
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }] },
      7,
    );
    expect(payload?.unitLines).toBeNull();
  });

  it('emits NO unitLines array on any entry the form can produce', () => {
    // `allowMultiple={false}` clamps the editor to one row, so `deriveUnitLinesPayload` can only
    // ever take the scalar branch. The key stays on the body — the endpoint does accept it — but it
    // is never an ARRAY, because the server would take the breakdown and throw it away, leaving the
    // detail screen the user lands on with nothing to render.
    const entries = [
      [{ unit: 'ml', perStock: 1, qty: 200 }],
      [{ unit: 'bottle', perStock: 500, qty: 2 }],
      // Even if a second row somehow reached the builder, this must still not become an array on
      // the wire — hence the clamp upstream, and hence this row in the table.
      [{ unit: 'bottle', perStock: 500, qty: 1 }],
    ];
    for (const unitRows of entries) {
      const payload = buildCreatePayload({ ...emptyForm(), itemId: 21, unitRows }, 7);
      expect(Object.keys(payload!)).toContain('unitLines');
      expect(Array.isArray(payload!.unitLines)).toBe(false);
      expect(payload!.unitLines).toBeNull();
    }
  });

  it('sends exactly the keys the controller reads, and no others', () => {
    // Most of the DTO is ignored server-side. Sending a field the controller drops is not free —
    // it reads as a promise the record does not keep the next time someone opens this file.
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }] },
      7,
    );
    expect(Object.keys(payload!).sort()).toEqual(
      [
        'businessId',
        'destType',
        'itemId',
        'notes',
        'quantity',
        'reason',
        'sourceType',
        'transferredAt',
        'unitLines',
        'unitMultiplier',
        'unitName',
      ].sort(),
    );
    // Not `itemName`: the server denormalises it from `itemId`, and the copy this form holds could
    // only ever be staler than the server's.
    expect(Object.keys(payload!)).not.toContain('itemName');
  });

  it('sends null, never an empty string, for an untouched timestamp', () => {
    // ⚠️ Spring reads `''` as a malformed date and answers 400. `null` means "stamp it now".
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }] },
      7,
    );
    expect(payload?.transferredAt).toBeNull();
    expect(payload?.notes).toBeNull();
  });

  it('passes a real timestamp through as the zone-less IST wall clock it is', () => {
    const payload = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        transferredAt: '2026-08-06T14:30:00',
        notes: '  opened for treatments  ',
        unitRows: [{ unit: 'ml', perStock: 1, qty: 200 }],
      },
      7,
    );
    expect(payload?.transferredAt).toBe('2026-08-06T14:30:00');
    expect(payload?.notes).toBe('opened for treatments');
  });

  it('is null when nothing is entered, so the caller fails validation instead of posting a zero', () => {
    expect(buildCreatePayload({ ...emptyForm(), itemId: 21 }, 7)).toBeNull();
    expect(
      buildCreatePayload(
        { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'ml', perStock: 1, qty: 0 }] },
        7,
      ),
    ).toBeNull();
  });
});
