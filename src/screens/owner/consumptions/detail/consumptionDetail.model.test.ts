import { buildCreatePayload, emptyForm, toFormState } from './consumptionDetail.model';

describe('emptyForm', () => {
  it('starts on the commonest reason rather than on nothing', () => {
    // An empty enum has no legal representation on the wire, and a required picker that starts
    // unset makes the commonest case the slowest one.
    expect(emptyForm().reason).toBe('SERVICE_USE');
  });

  it('leaves the timestamp EMPTY so the server stamps it', () => {
    // A form pre-filled with "now" is stale by the time it is submitted, and looks like a choice
    // the user made.
    expect(emptyForm().consumedAt).toBe('');
  });

  it('starts with no unit rows', () => {
    expect(emptyForm().unitRows).toEqual([]);
  });
});

describe('toFormState', () => {
  it('reads a saved record without splitting its quantity back into rows', () => {
    // Splitting would have to guess a ladder the record does not carry.
    const form = toFormState({
      itemId: 21,
      itemName: 'Bleach Powder',
      reason: 'TRAINING',
      quantity: 45,
      unitLines: [
        { unit: 'scoop', perStock: 30, qty: 1 },
        { unit: 'g', perStock: 1, qty: 15 },
      ],
    });
    expect(form.itemId).toBe(21);
    expect(form.reason).toBe('TRAINING');
    expect(form.unitRows).toHaveLength(2);
  });

  it('falls back to a blank form for a null record', () => {
    expect(toFormState(null)).toEqual(emptyForm());
  });

  it('defaults a record with no reason rather than leaving the enum empty', () => {
    expect(toFormState({ itemId: 1 }).reason).toBe('SERVICE_USE');
  });
});

describe('buildCreatePayload', () => {
  it('takes all four quantity fields from one call, in the SCALAR shape', () => {
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'scoop', perStock: 30, qty: 2 }] },
      7,
    );
    expect(payload).toMatchObject({
      businessId: 7,
      itemId: 21,
      reason: 'SERVICE_USE',
      quantity: 2,
      unitName: 'scoop',
      unitMultiplier: 30,
      unitLines: null,
    });
  });

  it('takes all four from the same call in the MIXED shape, with a multiplier of 1', () => {
    // The silent bug this pins: leave unitMultiplier on 30 while quantity already holds the base
    // total and the server deducts thirty times too much.
    const payload = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        unitRows: [
          { unit: 'scoop', perStock: 30, qty: 1 },
          { unit: 'g', perStock: 1, qty: 15 },
        ],
      },
      7,
    );
    expect(payload).toMatchObject({ quantity: 45, unitName: null, unitMultiplier: 1 });
    expect(payload?.unitLines).toHaveLength(2);
  });

  it('never sends a `inventoryType` — consumption always draws from RAW and the server fixes it', () => {
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'g', perStock: 1, qty: 30 }] },
      7,
    );
    expect(payload).not.toHaveProperty('inventoryType');
  });

  it('is null when nothing is entered, so the caller fails validation instead of posting a zero', () => {
    expect(buildCreatePayload({ ...emptyForm(), itemId: 21 }, 7)).toBeNull();
    expect(
      buildCreatePayload(
        { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'g', perStock: 1, qty: 0 }] },
        7,
      ),
    ).toBeNull();
  });
});
