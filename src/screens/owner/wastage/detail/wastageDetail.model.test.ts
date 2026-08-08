import { buildCreatePayload, emptyForm, toFormState } from './wastageDetail.model';

describe('emptyForm', () => {
  it('starts on the commonest reason rather than on nothing', () => {
    // An empty enum has no legal representation on the wire.
    expect(emptyForm().reason).toBe('EXPIRED');
  });

  it('leaves the timestamp EMPTY so the server stamps it', () => {
    expect(emptyForm().reportedAt).toBe('');
  });

  it('starts with no unit rows', () => {
    expect(emptyForm().unitRows).toEqual([]);
  });
});

describe('toFormState', () => {
  it('carries the pool through, because the two pools are different stock', () => {
    expect(toFormState({ inventoryType: 'RAW_INVENTORY' }).inventoryType).toBe('RAW_INVENTORY');
  });

  it('reads a CORRECTION record, even though no chip offers that value', () => {
    // A guard or a fallback that rejected it would make a system-written record unreadable on its
    // own detail screen.
    expect(toFormState({ reason: 'CORRECTION' }).reason).toBe('CORRECTION');
  });

  it('falls back to a blank form for a null record', () => {
    expect(toFormState(null)).toEqual(emptyForm());
  });
});

describe('buildCreatePayload', () => {
  it('takes all four quantity fields from one call, in the SCALAR shape', () => {
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

  it('takes all four from the same call in the MIXED shape, with a multiplier of 1', () => {
    // The silent bug this pins: leave unitMultiplier on 500 while quantity already holds the base
    // total and the write-off is five hundred times too large.
    const payload = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        unitRows: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      },
      7,
    );
    expect(payload).toMatchObject({ quantity: 600, unitName: null, unitMultiplier: 1 });
    expect(payload?.unitLines).toHaveLength(2);
  });

  it('ALWAYS sends the pool — unlike consumption, the server does not fix it', () => {
    const payload = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        inventoryType: 'RAW_INVENTORY',
        unitRows: [{ unit: 'ml', perStock: 1, qty: 100 }],
      },
      7,
    );
    expect(payload?.inventoryType).toBe('RAW_INVENTORY');
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
