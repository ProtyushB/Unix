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
