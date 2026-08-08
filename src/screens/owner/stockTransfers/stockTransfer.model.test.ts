import { listSubtitle, stockTransferName, toStockTransferRow } from './stockTransfer.model';

describe('stockTransferName', () => {
  it('prefers the denormalised name, which is why it is denormalised', () => {
    expect(stockTransferName({ itemName: 'Argan Oil', itemId: 21 })).toBe('Argan Oil');
  });

  it('falls back to the id rather than rendering a nameless row', () => {
    expect(stockTransferName({ itemId: 21 })).toBe('Product #21');
    expect(stockTransferName({ itemName: '   ', itemId: 21 })).toBe('Product #21');
    expect(stockTransferName({})).toBe('Unknown product');
  });
});

describe('toStockTransferRow', () => {
  it('carries BOTH pools, because they — not the reason — say which way the stock went', () => {
    // A record can carry reason PRODUCT_TO_RAW with sourceType RAW_INVENTORY; the server accepts it.
    // A row that drew its arrow from the reason would show the move backwards.
    const row = toStockTransferRow({
      sourceType: 'RAW_INVENTORY',
      destType: 'PRODUCT_INVENTORY',
      reason: 'PRODUCT_TO_RAW',
    });
    expect(row.sourceType).toBe('RAW_INVENTORY');
    expect(row.destType).toBe('PRODUCT_INVENTORY');
    expect(row.reason).toBe('PRODUCT_TO_RAW');
  });

  it('never guesses a pool', () => {
    expect(toStockTransferRow({}).sourceType).toBeNull();
    expect(toStockTransferRow({}).destType).toBeNull();
  });

  it('counts the ledger off `lines`, NOT off `deductions`', () => {
    // The copy-paste trap. A consumption's ledger is `deductions: {batchId, qty}[]`; reading that
    // name here yields undefined and a silent null count.
    const row = toStockTransferRow({
      lines: [
        { sourceBatchId: 41, destBatchId: 90, quantity: 500 },
        { sourceBatchId: 42, destBatchId: 90, quantity: 200 },
      ],
    });
    expect(row.hopCount).toBe(2);
    expect(toStockTransferRow({ deductions: [{ batchId: 1, qty: 5 }] }).hopCount).toBeNull();
  });

  it('reports an ABSENT ledger as null, never as zero', () => {
    // A list row carries no `lines` — the server only enriches the detail read.
    expect(toStockTransferRow({}).hopCount).toBeNull();
    expect(toStockTransferRow({ lines: [] }).hopCount).toBe(0);
  });

  it('reads the timestamp off `transferredAt`, not off a sibling feature field', () => {
    // The three features stamp three differently-named columns: consumedAt / reportedAt /
    // transferredAt. Reading the wrong one renders an empty date on every row.
    expect(toStockTransferRow({ transferredAt: '2026-07-22T10:15:00' }).whenText).toContain(
      '22 Jul 2026',
    );
    expect(toStockTransferRow({ reportedAt: '2026-07-22T10:15:00' }).whenText).toBe('');
  });

  it('renders the quantity from the scalar, because the server discards unitLines here', () => {
    expect(
      toStockTransferRow({ quantity: 2, unitName: 'bottle', unitLines: null }, 'ml').qtyText,
    ).toBe('2 bottles');
  });
});

describe('listSubtitle', () => {
  it('NEVER claims a record count', () => {
    // `/byBusiness` returns `totalPages` and nothing else.
    expect(listSubtitle(false)).not.toMatch(/\d/);
    expect(listSubtitle(true)).not.toMatch(/\d/);
  });

  it('says so when the list is narrowed', () => {
    expect(listSubtitle(true)).toMatch(/filtered/i);
  });
});
