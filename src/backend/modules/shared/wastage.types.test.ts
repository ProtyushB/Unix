import {
  DEFAULT_WASTAGE_SORT,
  WASTAGE_REASONS,
  WASTAGE_REASON_CHOICES,
  WASTAGE_SORT_KEYS,
  isWastageReason,
  type WastageDto,
  type WastagePayload,
} from './wastage.types';

describe('WASTAGE_REASONS', () => {
  it('carries exactly the eight server values', () => {
    // Membership is the server's DB CHECK constraint. A ninth here without a migration is a 500.
    expect([...WASTAGE_REASONS].sort()).toEqual([
      'CONTAMINATED',
      'CORRECTION',
      'DAMAGED',
      'EXPIRED',
      'LOST',
      'OTHER',
      'SPILLED',
      'THEFT',
    ]);
  });

  it('leads with EXPIRED and ends with OTHER', () => {
    expect(WASTAGE_REASONS[0]).toBe('EXPIRED');
    expect(WASTAGE_REASONS[WASTAGE_REASONS.length - 1]).toBe('OTHER');
  });
});

describe('WASTAGE_REASON_CHOICES', () => {
  it('offers SEVEN of the eight, holding CORRECTION back', () => {
    // CORRECTION is how a stock-count adjustment reaches the ledger. Offered on the Record Wastage
    // form it would invite someone reconciling a miscount to file it as a write-off, and the
    // wastage value would absorb an error that was never a loss.
    expect(WASTAGE_REASON_CHOICES).toHaveLength(7);
    expect(WASTAGE_REASON_CHOICES).not.toContain('CORRECTION');
  });

  it('is otherwise a faithful subset — no chip may offer a value the server refuses', () => {
    const legal = new Set<string>(WASTAGE_REASONS);
    for (const choice of WASTAGE_REASON_CHOICES) expect(legal.has(choice)).toBe(true);
  });

  it('hides exactly one member, and that member is CORRECTION', () => {
    // Stated as a difference rather than a length so the failure names the offender when the two
    // arrays drift.
    const offered = new Set<string>(WASTAGE_REASON_CHOICES);
    expect(WASTAGE_REASONS.filter((r) => !offered.has(r))).toEqual(['CORRECTION']);
  });
});

describe('isWastageReason', () => {
  it('accepts CORRECTION even though no chip offers it', () => {
    // The guard validates what the WIRE may carry, not what the form may offer. A guard that
    // rejected CORRECTION would make an existing record unreadable on its own detail screen.
    expect(isWastageReason('CORRECTION')).toBe(true);
  });

  it('accepts every listed reason', () => {
    for (const r of WASTAGE_REASONS) expect(isWastageReason(r)).toBe(true);
  });

  it('rejects anything else, which is what keeps a 500 from ever being sent', () => {
    // A bad enum is an HTTP 500 rather than a 400 — Spring never binds the body, so the handler
    // never runs and there is no validation error to surface.
    expect(isWastageReason('SERVICE_USE')).toBe(false);
    expect(isWastageReason('expired')).toBe(false);
    expect(isWastageReason('')).toBe(false);
  });

  it('rejects non-strings rather than coercing them', () => {
    expect(isWastageReason(null)).toBe(false);
    expect(isWastageReason(undefined)).toBe(false);
    expect(isWastageReason(0)).toBe(false);
  });
});

describe('sorting', () => {
  it('spells the whitelist exactly as the server does', () => {
    // Case matters and a miss is SILENT — the server falls back to its default rather than erroring.
    expect(WASTAGE_SORT_KEYS).toEqual([
      'id',
      'reportedAt',
      'itemName',
      'quantity',
      'reason',
      'inventoryType',
    ]);
  });

  it('is the only one of the three that can sort by pool', () => {
    // Wastage spans PRODUCT and RAW; consumption is RAW-only and a transfer has two ends rather
    // than one pool, so `inventoryType` is meaningful here and nowhere else.
    expect(WASTAGE_SORT_KEYS).toContain('inventoryType');
  });

  it('defaults to the timestamp', () => {
    expect(DEFAULT_WASTAGE_SORT).toBe('reportedAt');
    expect(WASTAGE_SORT_KEYS).toContain(DEFAULT_WASTAGE_SORT);
  });
});

describe('the ledger shape', () => {
  it('names its rows `deductions` with a `qty`, NOT `lines` with a `quantity`', () => {
    // Same trap as consumption: a stock transfer's ledger is
    // `lines: {sourceBatchId, destBatchId, quantity}[]`, and the two blocks look copy-pasteable
    // because Centrix names both locals `lines`. A copy renders an EMPTY table, silently.
    const dto: WastageDto = { id: 3, deductions: [{ batchId: 88, qty: 100 }] };
    expect(dto.deductions?.[0].qty).toBe(100);
    expect((dto as { lines?: unknown }).lines).toBeUndefined();
  });
});

describe('the create payload', () => {
  it('is addressed by the BATCH, and does not declare the three fields the server overwrites', () => {
    // ⚠️ Corrected against `WastageDto.java` while building the feature. An earlier draft of this
    // file made `itemId` + `inventoryType` the required addressing fields and had no `batchId` at
    // all, so every create would have failed its `@NotNull @Positive batchId`.
    //
    // `inventoryType`, `itemId` and `itemName` ARE mapped server-side and then unconditionally
    // overwritten in `recordWastage` from the named batch, so they are not on the interface: a
    // client that sent them would be stating three facts the server discards. The pool is still
    // asked for on the form — it decides WHICH batch — it just does not travel as its own key.
    const payload: WastagePayload = {
      businessId: 7,
      batchId: 88,
      reason: 'EXPIRED',
      quantity: 100,
      unitName: 'ml',
      unitMultiplier: 1,
      unitLines: null,
    };
    expect(payload.batchId).toBe(88);
    // Read through an index signature rather than off the type — the point of the assertion is that
    // the KEY is absent, and naming it on a typed payload would be a compile error instead.
    const keys = Object.keys(payload);
    expect(keys).not.toContain('itemId');
    expect(keys).not.toContain('itemName');
    expect(keys).not.toContain('inventoryType');
  });

  it('describes a mixed record with a BASE total and a multiplier of 1', () => {
    const payload: WastagePayload = {
      businessId: 7,
      batchId: 88,
      reason: 'DAMAGED',
      quantity: 600,
      unitName: null,
      unitMultiplier: 1,
      unitLines: [
        { unit: 'bottle', perStock: 500, qty: 1 },
        { unit: 'ml', perStock: 1, qty: 100 },
      ],
    };
    expect((payload.unitLines ?? []).reduce((s, l) => s + l.qty * l.perStock, 0)).toBe(
      payload.quantity,
    );
  });
});
