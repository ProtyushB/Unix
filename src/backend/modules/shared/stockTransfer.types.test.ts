import {
  DEFAULT_STOCK_TRANSFER_SORT,
  STOCK_TRANSFER_REASONS,
  STOCK_TRANSFER_SORT_KEYS,
  isStockTransferReason,
  type StockTransferDto,
  type StockTransferPayload,
  type StockTransferQuery,
} from './stockTransfer.types';

describe('STOCK_TRANSFER_REASONS', () => {
  it('carries exactly the five server values', () => {
    expect([...STOCK_TRANSFER_REASONS].sort()).toEqual([
      'CORRECTION',
      'OTHER',
      'PRODUCT_TO_RAW',
      'RAW_TO_PRODUCT',
      'REBALANCE',
    ]);
  });

  it('leads with the two directional reasons and ends with OTHER', () => {
    expect(STOCK_TRANSFER_REASONS.slice(0, 2)).toEqual(['PRODUCT_TO_RAW', 'RAW_TO_PRODUCT']);
    expect(STOCK_TRANSFER_REASONS[STOCK_TRANSFER_REASONS.length - 1]).toBe('OTHER');
  });

  it('offers CORRECTION, unlike wastage', () => {
    // A transfer corrects which POOL stock sits in and destroys nothing, so it cannot absorb a loss
    // the way a CORRECTION write-off would. One array here, two there — deliberately.
    expect(STOCK_TRANSFER_REASONS).toContain('CORRECTION');
  });
});

describe('isStockTransferReason', () => {
  it('accepts every listed reason', () => {
    for (const r of STOCK_TRANSFER_REASONS) expect(isStockTransferReason(r)).toBe(true);
  });

  it('rejects a reason borrowed from a sibling feature', () => {
    // The three enums share no members at all, so a form built by copying one of the others fails
    // here rather than at the server, where the answer is a 500 with nothing to read.
    expect(isStockTransferReason('SERVICE_USE')).toBe(false);
    expect(isStockTransferReason('EXPIRED')).toBe(false);
  });

  it('rejects non-strings rather than coercing them', () => {
    expect(isStockTransferReason(null)).toBe(false);
    expect(isStockTransferReason(undefined)).toBe(false);
    expect(isStockTransferReason(0)).toBe(false);
  });
});

describe('sorting', () => {
  it('spells the whitelist exactly as the server does', () => {
    expect(STOCK_TRANSFER_SORT_KEYS).toEqual([
      'id',
      'transferredAt',
      'itemName',
      'sourceType',
      'destType',
      'quantity',
      'reason',
    ]);
  });

  it('sorts by reason even though it cannot FILTER by it', () => {
    // The asymmetry that makes the missing query key surprising, stated where someone will read it.
    expect(STOCK_TRANSFER_SORT_KEYS).toContain('reason');
  });

  it('defaults to the timestamp', () => {
    expect(DEFAULT_STOCK_TRANSFER_SORT).toBe('transferredAt');
    expect(STOCK_TRANSFER_SORT_KEYS).toContain(DEFAULT_STOCK_TRANSFER_SORT);
  });
});

describe('StockTransferQuery', () => {
  it('has no `reason` key, and that omission is deliberate', () => {
    // The transfer controller reads no `reason` param: sending one is silently ignored and the list
    // comes back unfiltered. Both siblings DO accept it, so a filter sheet copied from wastage
    // would grow reason chips that appear to work and quietly do nothing.
    //
    // The compile-time half of this guard is the type itself — `{reason: 'REBALANCE'}` does not
    // assign to StockTransferQuery. This is the runtime half: the keys a query may carry.
    const query: StockTransferQuery = { search: 'argan', sortBy: 'transferredAt', sortDir: 'desc' };
    expect(Object.keys(query).sort()).toEqual(['search', 'sortBy', 'sortDir']);
    expect(Object.keys(query)).not.toContain('reason');
  });
});

describe('the ledger shape', () => {
  it('names its rows `lines` with a `quantity`, NOT `deductions` with a `qty`', () => {
    // The counterpart to the consumption/wastage assertion, and the reason both exist. Centrix
    // names BOTH locals `lines` and maps both `(ln, i) => …`, so the two blocks read as
    // interchangeable. Paste this one onto a consumption and `record.lines` is undefined — an
    // empty table with no error. Paste that one here and every amount cell reads `undefined`.
    const dto: StockTransferDto = {
      id: 5,
      lines: [
        { sourceBatchId: 41, destBatchId: 90, quantity: 500 },
        { sourceBatchId: 42, destBatchId: 90, quantity: 200 },
      ],
    };
    expect(dto.lines?.map((l) => l.quantity)).toEqual([500, 200]);
    expect((dto as { deductions?: unknown }).deductions).toBeUndefined();
  });

  it('carries BOTH batch ids, because a transfer has two ends', () => {
    const line = { sourceBatchId: 41, destBatchId: 90, quantity: 500 };
    const dto: StockTransferDto = { lines: [line] };
    expect(dto.lines?.[0].sourceBatchId).not.toBe(dto.lines?.[0].destBatchId);
    expect((line as { batchId?: unknown }).batchId).toBeUndefined();
  });
});

describe('the create payload', () => {
  it('is addressed by the SOURCE BATCH, which is what the controller reads', () => {
    // `sourceBatchId` is `@NotNull @Positive` and is forwarded positionally as the first argument to
    // `transfer(...)`; the server derives the product and the source pool from the batch it names.
    // Without it the body fails bean validation, so every create is a 400 before the handler runs.
    const payload: StockTransferPayload = {
      businessId: 7,
      sourceBatchId: 41,
      destType: 'RAW_INVENTORY',
      reason: 'PRODUCT_TO_RAW',
      quantity: 700,
      unitName: 'ml',
      unitMultiplier: 1,
    };
    expect(payload.sourceBatchId).toBeGreaterThan(0);
    expect(payload.destType).toBe('RAW_INVENTORY');
  });

  it('has no `itemId`, `itemName` or `sourceType` — all three are derived from the batch', () => {
    const payload: StockTransferPayload = {
      businessId: 7,
      sourceBatchId: 41,
      destType: 'PRODUCT_INVENTORY',
      reason: 'RAW_TO_PRODUCT',
      quantity: 2,
      unitName: 'bottle',
      unitMultiplier: 500,
    };
    // Reached through a cast because the type no longer admits them — which is the point: a client
    // that sent them would be stating facts the server never reads.
    const loose = payload as unknown as Record<string, unknown>;
    expect(loose.itemId).toBeUndefined();
    expect(loose.itemName).toBeUndefined();
    expect(loose.sourceType).toBeUndefined();
  });

  it('has no `unitLines` key at all, so a breakdown cannot be sent even by accident', () => {
    // It used to be declared and always null. Ignored server-side either way — the destination batch
    // is rebuilt from the scalar total — but "declared and null" invited someone to fill it in.
    // Removing the key makes that a compile error. It is also why the transfer form passes
    // `allowMultiple={false}` to `UnitRowsEditor`: with one row the mixed branch is unreachable.
    const payload: StockTransferPayload = {
      businessId: 7,
      sourceBatchId: 41,
      destType: 'PRODUCT_INVENTORY',
      reason: 'REBALANCE',
      quantity: 2,
      unitName: 'bottle',
      unitMultiplier: 500,
    };
    expect((payload as unknown as Record<string, unknown>).unitLines).toBeUndefined();
    // `StockTransferDto` still declares it, because a RESPONSE has to be readable through that shape.
    const dto: StockTransferDto = { unitLines: null };
    expect(dto.unitLines).toBeNull();
  });

  it('has no `transferredAt` — the controller ignores it and stamps the row itself', () => {
    const payload: StockTransferPayload = {
      businessId: 7,
      sourceBatchId: 41,
      destType: 'RAW_INVENTORY',
      reason: 'CORRECTION',
      quantity: 1,
    };
    expect((payload as unknown as Record<string, unknown>).transferredAt).toBeUndefined();
  });
});
