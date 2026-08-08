import {
  CONSUMED_TIME_SLOTS,
  aggregateRawStock,
  buildCreatePayload,
  emptyForm,
  formatClock,
  joinConsumedAt,
  nextUnitRow,
  pickerStock,
  productBaseUnit,
  snapToSlot,
  splitConsumedAt,
  toFormState,
} from './consumptionDetail.model';

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

  it('SENDS itemName — the list can only be searched by it, and there is no PUT to repair it', () => {
    const payload = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        itemName: 'Bleach Powder',
        unitRows: [{ unit: 'g', perStock: 1, qty: 30 }],
      },
      7,
    );
    expect(payload?.itemName).toBe('Bleach Powder');
  });

  it('sends null rather than an empty name, which would overwrite the server’s own derivation', () => {
    const payload = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        itemName: '   ',
        unitRows: [{ unit: 'g', perStock: 1, qty: 30 }],
      },
      7,
    );
    expect(payload?.itemName).toBeNull();
  });

  it('turns an empty consumedAt into NULL, never into `""`', () => {
    // `''` is a malformed date to Spring and answers 400; `null` means "stamp it now".
    const blank = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'g', perStock: 1, qty: 30 }] },
      7,
    );
    expect(blank?.consumedAt).toBeNull();

    const stamped = buildCreatePayload(
      {
        ...emptyForm(),
        itemId: 21,
        consumedAt: '2026-08-05T17:10:00',
        unitRows: [{ unit: 'g', perStock: 1, qty: 30 }],
      },
      7,
    );
    expect(stamped?.consumedAt).toBe('2026-08-05T17:10:00');
  });

  it('never sends a batchId or an appointmentId', () => {
    // The server picks the batches itself, FEFO, and a consumption is not tied to an appointment.
    const payload = buildCreatePayload(
      { ...emptyForm(), itemId: 21, unitRows: [{ unit: 'g', perStock: 1, qty: 30 }] },
      7,
    );
    expect(payload).not.toHaveProperty('batchId');
    expect(payload).not.toHaveProperty('appointmentId');
  });
});

describe('aggregateRawStock', () => {
  it('sums a product’s remaining stock across its batches and counts them', () => {
    const map = aggregateRawStock([
      { itemId: 21, remainingQuantity: 120, stockInUnit: 'tub', stockInMultiplier: 60 },
      { itemId: 21, remainingQuantity: 60 },
      { itemId: 33, remainingQuantity: 200 },
    ]);
    expect(map[21]).toEqual({
      baseQty: 180,
      activeBatches: 2,
      level: { unit: 'tub', perStock: 60 },
    });
    expect(map[33].baseQty).toBe(200);
  });

  it('SKIPS batches at zero — FEFO cannot draw from them, so they are not "active"', () => {
    // Counting them would put a number in "Across N active RAW batches" that does not match what
    // the deduction is about to do.
    const map = aggregateRawStock([
      { itemId: 21, remainingQuantity: 0 },
      { itemId: 21, remainingQuantity: 45 },
    ]);
    expect(map[21]).toEqual({ baseQty: 45, activeBatches: 1, level: null });
  });

  it('leaves a product with nothing left out of the map entirely', () => {
    expect(aggregateRawStock([{ itemId: 21, remainingQuantity: 0 }])[21]).toBeUndefined();
    expect(aggregateRawStock([])).toEqual({});
    expect(aggregateRawStock(null)).toEqual({});
  });

  it('ignores a batch with no product id rather than keying the map on NaN', () => {
    expect(aggregateRawStock([{ remainingQuantity: 45 }])).toEqual({});
  });
});

describe('productBaseUnit', () => {
  it('prefers the ladder’s base rung', () => {
    expect(
      productBaseUnit({
        saleUnits: [
          { unit: 'g', perStock: 1 },
          { unit: 'tub', perStock: 60 },
        ],
      }),
    ).toBe('g');
  });

  it('falls back to the bare stock unit, then to a word — never to an empty string', () => {
    // Every label in this feature reads "45 <baseUnit>"; '' renders "45 " with a hole in it.
    expect(productBaseUnit({ stockUnit: 'ml' })).toBe('ml');
    expect(productBaseUnit({})).toBe('unit');
    expect(productBaseUnit(null)).toBe('unit');
  });
});

describe('pickerStock', () => {
  it('shows the total and the level it breaks into', () => {
    expect(
      pickerStock({ baseQty: 180, activeBatches: 3, level: { unit: 'tub', perStock: 60 } }, 'g'),
    ).toEqual({ total: '180 g', breakdown: '3 tubs' });
  });

  it('drops a breakdown that would only repeat the total', () => {
    expect(pickerStock({ baseQty: 180, activeBatches: 1, level: null }, 'g')).toEqual({
      total: '180 g',
      breakdown: null,
    });
  });

  it('draws "0 ml" for an empty shelf rather than nothing, so the row does not look broken', () => {
    // The row is about to be rendered inert; a blank slot would read as missing data.
    expect(pickerStock(undefined, 'ml').total).toBe('0 ml');
  });
});

describe('nextUnitRow', () => {
  const ladder = [
    { unit: 'g', perStock: 1 },
    { unit: 'scoop', perStock: 30 },
  ];

  it('adds the largest rung not already on screen — row one is always the base', () => {
    expect(nextUnitRow(ladder, [{ unit: 'g', perStock: 1, qty: 15 }])).toEqual({
      unit: 'scoop',
      perStock: 30,
      qty: 0,
    });
  });

  it('starts the new row at zero, not at the rung it copied from', () => {
    expect(nextUnitRow(ladder, []).qty).toBe(0);
  });

  it('never emits a row with an undefined multiplier, which would multiply by NaN', () => {
    // `showsAddUnitRow` should have hidden the button by now; this is the stale-render guard.
    const exhausted = nextUnitRow(ladder, [
      { unit: 'g', perStock: 1, qty: 1 },
      { unit: 'scoop', perStock: 30, qty: 1 },
    ]);
    expect(exhausted).toEqual({ unit: '', perStock: 1, qty: 0 });
    expect(nextUnitRow(null, null)).toEqual({ unit: '', perStock: 1, qty: 0 });
  });
});

describe('CONSUMED_TIME_SLOTS', () => {
  it('covers the whole day in quarter hours, zero-padded', () => {
    expect(CONSUMED_TIME_SLOTS).toHaveLength(96);
    expect(CONSUMED_TIME_SLOTS[0]).toBe('00:00');
    expect(CONSUMED_TIME_SLOTS[1]).toBe('00:15');
    expect(CONSUMED_TIME_SLOTS[95]).toBe('23:45');
  });
});

describe('formatClock', () => {
  it('renders a 24-hour slot as a 12-hour label with an UPPERCASE meridiem', () => {
    expect(formatClock('17:10')).toBe('5:10 PM');
    expect(formatClock('09:05')).toBe('9:05 AM');
  });

  it('handles both ends, where `% 12` alone gives a nonsense 0', () => {
    expect(formatClock('00:00')).toBe('12:00 AM');
    expect(formatClock('12:30')).toBe('12:30 PM');
  });

  it('renders empty rather than a partial label', () => {
    expect(formatClock('')).toBe('');
    expect(formatClock(null)).toBe('');
    expect(formatClock('nonsense')).toBe('');
  });
});

describe('splitConsumedAt / joinConsumedAt', () => {
  it('round-trips a stored wall clock through the two controls that edit it', () => {
    const parts = splitConsumedAt('2026-08-05T17:10:00');
    expect(parts).toEqual({ date: '2026-08-05', time: '17:10' });
    expect(joinConsumedAt(parts.date, parts.time)).toBe('2026-08-05T17:10:00');
  });

  it('splits by STRING, never through `new Date` — the value carries no zone', () => {
    // Parsing it would read as device-local: right by accident on an IST phone, wrong in the web
    // preview and wrong for anyone travelling.
    expect(splitConsumedAt('2026-01-01T00:30:00').date).toBe('2026-01-01');
    expect(splitConsumedAt('').date).toBe('');
    expect(splitConsumedAt(null)).toEqual({ date: '', time: '' });
  });

  it('always emits SECONDS — the backend parses with ISO_LOCAL_DATE_TIME and rejects them missing', () => {
    expect(joinConsumedAt('2026-08-05', '17:10')).toBe('2026-08-05T17:10:00');
    expect(joinConsumedAt('2026-08-05', '17:10:30')).toBe('2026-08-05T17:10:30');
  });

  it('answers empty for a missing DATE, which is what "let the server stamp it" looks like', () => {
    expect(joinConsumedAt('', '17:10')).toBe('');
  });

  it('does NOT discard a picked date just because the clock is unset', () => {
    expect(joinConsumedAt('2026-08-05', '')).toBe('2026-08-05T00:00:00');
  });
});

describe('snapToSlot', () => {
  it('FLOORS onto the quarter hour, so a seeded clock is never in the future', () => {
    expect(snapToSlot('17:10')).toBe('17:00');
    expect(snapToSlot('17:59')).toBe('17:45');
    expect(snapToSlot('17:15')).toBe('17:15');
    expect(snapToSlot('00:07')).toBe('00:00');
  });

  it('lands on a real slot so the picker always has something selected', () => {
    expect(CONSUMED_TIME_SLOTS).toContain(snapToSlot('23:59'));
    expect(CONSUMED_TIME_SLOTS).toContain(snapToSlot('rubbish'));
    expect(snapToSlot(null)).toBe('00:00');
  });
});
