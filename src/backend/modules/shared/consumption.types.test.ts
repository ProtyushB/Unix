import {
  CONSUMPTION_REASONS,
  CONSUMPTION_SORT_KEYS,
  DEFAULT_CONSUMPTION_SORT,
  isConsumptionReason,
  type ConsumptionDto,
  type ConsumptionPayload,
} from './consumption.types';

describe('CONSUMPTION_REASONS', () => {
  it('carries exactly the six server values', () => {
    // Pinned as a set: the ORDER is a design decision (tested below) but the MEMBERSHIP is the
    // server's DB CHECK constraint, and adding a seventh here without a migration is a 500.
    expect([...CONSUMPTION_REASONS].sort()).toEqual([
      'INTERNAL_USE',
      'OTHER',
      'SAMPLING',
      'SERVICE_USE',
      'TESTING',
      'TRAINING',
    ]);
  });

  it('leads with SERVICE_USE, which is the reason behind almost every record', () => {
    expect(CONSUMPTION_REASONS[0]).toBe('SERVICE_USE');
  });

  it('ends with OTHER, so the escape hatch is never the first thing offered', () => {
    expect(CONSUMPTION_REASONS[CONSUMPTION_REASONS.length - 1]).toBe('OTHER');
  });

  it('exposes EVERY reason — unlike wastage there is no hidden member', () => {
    // The reason this file has one array and wastage.types has two. If a system-only consumption
    // reason is ever added, this test is where the second array gets introduced.
    expect(CONSUMPTION_REASONS).toHaveLength(6);
  });
});

describe('isConsumptionReason', () => {
  it('accepts every listed reason', () => {
    for (const r of CONSUMPTION_REASONS) expect(isConsumptionReason(r)).toBe(true);
  });

  it('rejects anything else, which is what keeps a 500 from ever being sent', () => {
    // A bad enum is an HTTP 500 rather than a 400 — Spring never binds the body, so there is no
    // validation error to surface. The guard has to catch it locally or the user sees nothing
    // actionable.
    expect(isConsumptionReason('EXPIRED')).toBe(false);
    expect(isConsumptionReason('service_use')).toBe(false);
    expect(isConsumptionReason('')).toBe(false);
  });

  it('rejects non-strings rather than coercing them', () => {
    // Route params and stored session values arrive untyped; `null` must not pass as "no reason".
    expect(isConsumptionReason(null)).toBe(false);
    expect(isConsumptionReason(undefined)).toBe(false);
    expect(isConsumptionReason(0)).toBe(false);
    expect(isConsumptionReason(['SERVICE_USE'])).toBe(false);
  });
});

describe('sorting', () => {
  it('spells the whitelist exactly as the server does', () => {
    // Case matters and a miss is SILENT — the server falls back to its default rather than
    // erroring, so `consumedat` yields a list that looks sorted and is not.
    expect(CONSUMPTION_SORT_KEYS).toEqual(['id', 'consumedAt', 'itemName', 'quantity', 'reason']);
  });

  it('defaults to the timestamp, which is the only key that reads as "newest first"', () => {
    expect(DEFAULT_CONSUMPTION_SORT).toBe('consumedAt');
    expect(CONSUMPTION_SORT_KEYS).toContain(DEFAULT_CONSUMPTION_SORT);
  });
});

describe('the ledger shape', () => {
  it('names its rows `deductions` with a `qty`, NOT `lines` with a `quantity`', () => {
    // The copy-paste trap this type exists to catch. A stock transfer's ledger is
    // `lines: {sourceBatchId, destBatchId, quantity}[]`; both blocks look interchangeable in
    // Centrix because both name the local `lines`. Pasting the transfer block here reads
    // `record.lines` — undefined — and renders an EMPTY table with no error at all.
    const dto: ConsumptionDto = {
      id: 12,
      deductions: [
        { batchId: 41, qty: 30 },
        { batchId: 42, qty: 15 },
      ],
    };
    expect(dto.deductions?.map((d) => d.qty)).toEqual([30, 15]);
    expect((dto as { lines?: unknown }).lines).toBeUndefined();
  });

  it('totals the ledger in base units', () => {
    const dto: ConsumptionDto = {
      deductions: [
        { batchId: 1, qty: 30 },
        { batchId: 2, qty: 15 },
      ],
    };
    expect((dto.deductions ?? []).reduce((s, d) => s + d.qty, 0)).toBe(45);
  });
});

describe('the create payload', () => {
  it('describes a single-level record with a scalar and a null unitLines', () => {
    // `quantity` is in LEVEL units here, and the server multiplies by `unitMultiplier`.
    const payload: ConsumptionPayload = {
      businessId: 7,
      itemId: 21,
      reason: 'SERVICE_USE',
      quantity: 1,
      unitName: 'scoop',
      unitMultiplier: 30,
      unitLines: null,
    };
    expect(payload.quantity * (payload.unitMultiplier ?? 1)).toBe(30);
  });

  it('describes a mixed record with a BASE total and a multiplier of 1', () => {
    // `quantity` has already been multiplied out; sending the level multiplier again would double
    // the deduction.
    const payload: ConsumptionPayload = {
      businessId: 7,
      itemId: 21,
      reason: 'SERVICE_USE',
      quantity: 45,
      unitName: null,
      unitMultiplier: 1,
      unitLines: [
        { unit: 'scoop', perStock: 30, qty: 1 },
        { unit: 'g', perStock: 1, qty: 15 },
      ],
    };
    expect(payload.unitMultiplier).toBe(1);
    expect((payload.unitLines ?? []).reduce((s, l) => s + l.qty * l.perStock, 0)).toBe(
      payload.quantity,
    );
  });
});
