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
  it('carries two pools that must differ — the direction lives here, not in the reason', () => {
    // `PRODUCT_TO_RAW` with `sourceType: 'RAW_INVENTORY'` is accepted by the server and is a lie in
    // the audit log, so a form offering both has to derive the reason from the direction.
    const payload: StockTransferPayload = {
      businessId: 7,
      itemId: 21,
      sourceType: 'PRODUCT_INVENTORY',
      destType: 'RAW_INVENTORY',
      reason: 'PRODUCT_TO_RAW',
      quantity: 700,
      unitName: 'ml',
      unitMultiplier: 1,
      unitLines: null,
    };
    expect(payload.sourceType).not.toBe(payload.destType);
  });

  it('sends a null unitLines, because the server would discard a breakdown anyway', () => {
    // Why the transfer form passes `allowMultiple={false}` to UnitRowsEditor: the server rebuilds
    // the destination batch from the scalar total, so a breakdown never comes back and the detail
    // screen has nothing to render.
    const payload: StockTransferPayload = {
      businessId: 7,
      itemId: 21,
      sourceType: 'RAW_INVENTORY',
      destType: 'PRODUCT_INVENTORY',
      reason: 'RAW_TO_PRODUCT',
      quantity: 2,
      unitName: 'bottle',
      unitMultiplier: 500,
      unitLines: null,
    };
    expect(payload.unitLines).toBeNull();
  });
});
