import {
  availabilityHelper,
  availableBaseQty,
  buildCreatePayload,
  emptyForm,
  enteredAsLine,
  enteredBaseQty,
  pickWriteOffBatch,
  recordBaseUnit,
  toBatchBreakdown,
  toFormState,
  wastageBaseQty,
  writeOffBatchCount,
  type WriteOffBatch,
} from './wastageDetail.model';

describe('emptyForm', () => {
  it('starts on the reason the Record Wastage board draws pre-selected', () => {
    // An empty enum has no legal representation on the wire, so the form has to start somewhere.
    expect(emptyForm().reason).toBe('DAMAGED');
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

describe('pickWriteOffBatch', () => {
  const batches: WriteOffBatch[] = [
    { id: 9, status: 'ACTIVE', remainingQuantity: 400 },
    { id: 4, status: 'DEPLETED', remainingQuantity: 0 },
    { id: 6, status: 'ACTIVE', remainingQuantity: 200 },
    { id: 2, status: 'ON_HOLD', remainingQuantity: 900 },
  ];

  it('takes the LOWEST-ID active batch that still has stock', () => {
    // Lowest id rather than nearest expiry: it is where the server itself starts, and picking a
    // different one would show the user one batch while the write-off came out of another.
    expect(pickWriteOffBatch(batches)).toBe(6);
  });

  it('ignores every status that is not ACTIVE, however much stock it holds', () => {
    // ON_HOLD id 2 holds the most stock here and is still not a batch the server will draw from.
    expect(pickWriteOffBatch([{ id: 2, status: 'ON_HOLD', remainingQuantity: 900 }])).toBeNull();
    expect(pickWriteOffBatch([{ id: 2, status: 'EXPIRED', remainingQuantity: 900 }])).toBeNull();
  });

  it('ignores an active batch that has been drawn to zero', () => {
    expect(pickWriteOffBatch([{ id: 3, status: 'ACTIVE', remainingQuantity: 0 }])).toBeNull();
  });

  it('is null for nothing at all, which is the signal the validator turns into a message', () => {
    expect(pickWriteOffBatch(null)).toBeNull();
    expect(pickWriteOffBatch([])).toBeNull();
  });
});

describe('availableBaseQty / writeOffBatchCount', () => {
  const batches: WriteOffBatch[] = [
    { id: 1, status: 'ACTIVE', remainingQuantity: 4000 },
    { id: 2, status: 'ACTIVE', remainingQuantity: 2000 },
    { id: 3, status: 'ACTIVE', remainingQuantity: 0 },
    { id: 4, status: 'EXPIRED', remainingQuantity: 5000 },
  ];

  it('totals only what the server would actually draw from', () => {
    expect(availableBaseQty(batches)).toBe(6000);
  });

  it('counts only the batches holding stock, so "across N batches" is not a lie', () => {
    expect(writeOffBatchCount(batches)).toBe(2);
  });
});

describe('availabilityHelper', () => {
  it('reports the total, the batch count and the oldest-first rule', () => {
    // The tail is the only place the screen says one entry can span several batches — which is why
    // there is no batch picker to go looking for.
    const line = availabilityHelper(
      [
        { id: 1, status: 'ACTIVE', remainingQuantity: 4000 },
        { id: 2, status: 'ACTIVE', remainingQuantity: 1500 },
        { id: 3, status: 'ACTIVE', remainingQuantity: 500 },
      ],
      'ml',
    );
    expect(line).toContain('6,000 ml');
    expect(line).toContain('across 3 batches');
    expect(line).toContain('oldest-first');
  });

  it('drops the oldest-first tail when there is only one batch to draw from', () => {
    const line = availabilityHelper([{ id: 1, status: 'ACTIVE', remainingQuantity: 90 }], 'ml');
    expect(line).toContain('across 1 batch');
    expect(line).not.toContain('oldest-first');
  });

  it('says so plainly when the pool is empty', () => {
    expect(availabilityHelper([], 'ml')).toMatch(/No stock available/i);
  });

  it('is NULL before a product is picked — null is not zero', () => {
    // "Available: 0" would read as an empty shelf rather than as an unanswered question.
    expect(availabilityHelper(null, 'ml')).toBeNull();
  });
});

describe('enteredBaseQty', () => {
  it('multiplies a scalar entry out to base units', () => {
    expect(
      enteredBaseQty({ ...emptyForm(), unitRows: [{ unit: 'bottle', perStock: 500, qty: 2 }] }),
    ).toBe(1000);
  });

  it('leaves a mixed entry alone, because its quantity is ALREADY the base total', () => {
    // Multiplying again is the silent overcount `deriveUnitLinesPayload` exists to prevent.
    expect(
      enteredBaseQty({
        ...emptyForm(),
        unitRows: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      }),
    ).toBe(600);
  });

  it('is zero for an untouched form', () => {
    expect(enteredBaseQty(emptyForm())).toBe(0);
  });
});

describe('buildCreatePayload', () => {
  const form = { ...emptyForm(), itemId: 21 };

  it('addresses the write-off by BATCH and omits the three server-derived fields', () => {
    // ⚠️ The server reads the product, its name and the pool off the batch and overwrites whatever
    // a client sends in those keys, so sending them would be three fields that look authoritative
    // and are not. The pool is still asked for on the form — it decides WHICH batch.
    const payload = buildCreatePayload(
      { ...form, inventoryType: 'RAW_INVENTORY', unitRows: [{ unit: 'ml', perStock: 1, qty: 50 }] },
      7,
      88,
    );
    expect(payload).toMatchObject({ businessId: 7, batchId: 88 });
    expect(payload).not.toHaveProperty('itemId');
    expect(payload).not.toHaveProperty('itemName');
    expect(payload).not.toHaveProperty('inventoryType');
  });

  it('does not send `reportedAt` at all, so the server stamps it', () => {
    // The form collects no date, and an empty string would be a malformed date rather than "now".
    const payload = buildCreatePayload(
      { ...form, unitRows: [{ unit: 'ml', perStock: 1, qty: 50 }] },
      7,
      88,
    );
    expect(payload).not.toHaveProperty('reportedAt');
  });

  it('takes all four quantity fields from one call, in the SCALAR shape', () => {
    const payload = buildCreatePayload(
      { ...form, unitRows: [{ unit: 'bottle', perStock: 500, qty: 2 }] },
      7,
      88,
    );
    expect(payload).toMatchObject({
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
        ...form,
        unitRows: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      },
      7,
      88,
    );
    expect(payload).toMatchObject({ quantity: 600, unitName: null, unitMultiplier: 1 });
    expect(payload?.unitLines).toHaveLength(2);
  });

  it('drops a whitespace-only note rather than storing it as one', () => {
    const payload = buildCreatePayload(
      { ...form, notes: '   ', unitRows: [{ unit: 'ml', perStock: 1, qty: 5 }] },
      7,
      88,
    );
    expect(payload?.notes).toBeNull();
  });

  it('is null when nothing is entered, so the caller fails validation instead of posting a zero', () => {
    expect(buildCreatePayload(form, 7, 88)).toBeNull();
    expect(
      buildCreatePayload({ ...form, unitRows: [{ unit: 'ml', perStock: 1, qty: 0 }] }, 7, 88),
    ).toBeNull();
  });

  it('is null with no batch, because a payload with no `batchId` is a 400 naming a hidden field', () => {
    expect(
      buildCreatePayload({ ...form, unitRows: [{ unit: 'ml', perStock: 1, qty: 5 }] }, 7, null),
    ).toBeNull();
  });
});

describe('wastageBaseQty', () => {
  it('multiplies a scalar record out, so two 500 ml bottles do not read as "2"', () => {
    expect(wastageBaseQty({ quantity: 2, unitName: 'bottle', unitMultiplier: 500 })).toBe(1000);
  });

  it('leaves a mixed record alone, because its quantity is already the base total', () => {
    expect(
      wastageBaseQty({
        quantity: 600,
        unitMultiplier: 1,
        unitLines: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      }),
    ).toBe(600);
  });

  it('keeps a missing quantity null — a record of nothing is not a record of zero', () => {
    expect(wastageBaseQty({})).toBeNull();
    expect(wastageBaseQty(null)).toBeNull();
  });
});

describe('enteredAsLine', () => {
  it('translates a mixed record into how it was typed', () => {
    expect(
      enteredAsLine(
        {
          quantity: 600,
          unitMultiplier: 1,
          unitLines: [
            { unit: 'bottle', perStock: 500, qty: 1 },
            { unit: 'ml', perStock: 1, qty: 100 },
          ],
        },
        'ml',
      ),
    ).toBe('Entered as 1 bottle · 100 ml');
  });

  it('uses `·` rather than `+`, matching every other quantity on these screens', () => {
    const line = enteredAsLine(
      {
        quantity: 600,
        unitMultiplier: 1,
        unitLines: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      },
      'ml',
    );
    expect(line).not.toContain('+');
  });

  it('is null when it would only restate the base figure above it', () => {
    // "600 ml / Entered as 600 ml" makes the reader look for a difference that is not there.
    expect(enteredAsLine({ quantity: 600, unitName: 'ml', unitMultiplier: 1 }, 'ml')).toBeNull();
  });

  it('is null for a record with no quantity at all', () => {
    expect(enteredAsLine({}, 'ml')).toBeNull();
    expect(enteredAsLine(null, 'ml')).toBeNull();
  });
});

describe('toBatchBreakdown', () => {
  it('reads `deductions` with a `qty` — NOT `lines` with a `quantity`', () => {
    // A stock transfer's ledger is `lines: {sourceBatchId, destBatchId, quantity}[]`. The two
    // blocks look copy-pasteable and a copy renders an EMPTY table with no error at all.
    const rows = toBatchBreakdown([{ batchId: 4, qty: 400 }], 'ml', { 4: 'BATCH-260620-04' });
    expect(rows).toEqual([{ batchId: 4, batchLabel: 'BATCH-260620-04', qtyText: '400 ml' }]);
  });

  it('falls back to the id rather than rendering a hole when the number is unknown', () => {
    // The server's ledger carries ids only; the printed number has to be hydrated separately.
    expect(toBatchBreakdown([{ batchId: 11, qty: 200 }], 'ml')[0].batchLabel).toBe('Batch #11');
  });

  it('is empty for an un-enriched record, so the caller draws no card', () => {
    expect(toBatchBreakdown(null)).toEqual([]);
    expect(toBatchBreakdown([])).toEqual([]);
  });
});

describe('recordBaseUnit', () => {
  it('takes the LOWEST rung of a mixed record, which is the base one by definition', () => {
    expect(
      recordBaseUnit({
        unitLines: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      }),
    ).toBe('ml');
  });

  it('takes the unit off a scalar record entered at the base rung', () => {
    expect(recordBaseUnit({ quantity: 600, unitName: 'ml', unitMultiplier: 1 })).toBe('ml');
  });

  it('falls back when the record was entered in a HIGHER rung, whose name is not the base one', () => {
    // "2 bottles" carries no name for what a bottle is made of, and guessing "bottle" would render
    // the hero as "1000 bottle".
    expect(recordBaseUnit({ quantity: 2, unitName: 'bottle', unitMultiplier: 500 }, 'unit')).toBe(
      'unit',
    );
  });
});
