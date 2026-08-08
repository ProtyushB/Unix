import {
  HOP_DEST_LABEL,
  HOP_SOURCE_LABEL,
  hasLedger,
  isMintedBatchNumber,
  mintedBatchNumber,
  reversalNote,
  toTransferHops,
} from './stockTransferLedger';

describe('toTransferHops', () => {
  it('reads the amount off `quantity`, NOT off `qty`', () => {
    // The copy-paste trap: a consumption hop is `{batchId, qty}`. Reading `qty` here fills every
    // amount cell with `undefined` and nothing errors.
    const [hop] = toTransferHops([{ sourceBatchId: 41, destBatchId: 90, quantity: 700 }], 'ml');
    expect(hop.qtyText).toBe('700 ml');
  });

  it('renders a hop even when the response carried no batch numbers', () => {
    const [hop] = toTransferHops([{ sourceBatchId: 41, destBatchId: 90, quantity: 700 }], 'ml');
    expect(hop.sourceBatch).toBe('Batch #41');
    expect(hop.destBatch).toBe('Batch #90');
    // Nothing was derived, so nothing is claimed — an unearned "New" badge is worse than none.
    expect(hop.destIsNew).toBe(false);
  });

  it('mints the destination number off the source when the server sent only the source', () => {
    const [hop] = toTransferHops(
      [
        {
          sourceBatchId: 41,
          destBatchId: 90,
          quantity: 700,
          sourceBatchNumber: 'BATCH-260710-02',
        } as never,
      ],
      'ml',
    );
    expect(hop.sourceBatch).toBe('BATCH-260710-02');
    expect(hop.destBatch).toBe('BATCH-260710-02-T1');
    expect(hop.destIsNew).toBe(true);
  });

  it('prefers an explicit destination number over the derived one', () => {
    const [hop] = toTransferHops(
      [
        {
          sourceBatchId: 41,
          destBatchId: 90,
          quantity: 700,
          sourceBatchNumber: 'BATCH-260710-02',
          destBatchNumber: 'BATCH-250101-07',
        } as never,
      ],
      'ml',
    );
    expect(hop.destBatch).toBe('BATCH-250101-07');
    // A pre-existing batch that was topped up is not new, and must not wear the badge.
    expect(hop.destIsNew).toBe(false);
  });

  it('numbers the minted batches per hop', () => {
    const hops = toTransferHops(
      [
        { sourceBatchId: 41, destBatchId: 90, quantity: 500, sourceBatchNumber: 'B-1' } as never,
        { sourceBatchId: 42, destBatchId: 91, quantity: 200, sourceBatchNumber: 'B-2' } as never,
      ],
      'ml',
    );
    expect(hops.map((h) => h.destBatch)).toEqual(['B-1-T1', 'B-2-T2']);
  });

  it('keeps the server ORDER, because FEFO order is the information', () => {
    // Re-sorting by id or quantity throws away the only record of which stock actually left.
    const hops = toTransferHops([
      { sourceBatchId: 90, destBatchId: 1, quantity: 100 },
      { sourceBatchId: 41, destBatchId: 2, quantity: 900 },
    ]);
    expect(hops.map((h) => h.sourceBatch)).toEqual(['Batch #90', 'Batch #41']);
  });

  it('gives every hop a stable key, even for two hops into one destination batch', () => {
    const hops = toTransferHops([
      { sourceBatchId: 41, destBatchId: 90, quantity: 500 },
      { sourceBatchId: 42, destBatchId: 90, quantity: 200 },
    ]);
    expect(new Set(hops.map((h) => h.key)).size).toBe(2);
  });

  it('is empty rather than throwing on a list row, which carries no ledger', () => {
    expect(toTransferHops(null)).toEqual([]);
    expect(toTransferHops(undefined)).toEqual([]);
  });
});

describe('mintedBatchNumber', () => {
  it('suffixes the source number, 1-based', () => {
    expect(mintedBatchNumber('BATCH-260710-02', 0)).toBe('BATCH-260710-02-T1');
    expect(mintedBatchNumber('BATCH-260710-02', 2)).toBe('BATCH-260710-02-T3');
  });

  it('recognises its own output, and only its own', () => {
    expect(isMintedBatchNumber('BATCH-260710-02-T1')).toBe(true);
    expect(isMintedBatchNumber('BATCH-260710-02')).toBe(false);
    expect(isMintedBatchNumber('')).toBe(false);
  });
});

describe('hasLedger', () => {
  it('is false for a list row and true for a fetched detail', () => {
    // `/byBusiness` never enriches `lines`; only the GET-one read does.
    expect(hasLedger({ id: 4 })).toBe(false);
    expect(hasLedger({ id: 4, lines: [] })).toBe(false);
    expect(hasLedger({ id: 4, lines: [{ sourceBatchId: 1, destBatchId: 2, quantity: 5 }] })).toBe(
      true,
    );
  });

  it('is not fooled by a consumption-shaped ledger', () => {
    expect(hasLedger({ id: 4, deductions: [{ batchId: 1, qty: 5 }] })).toBe(false);
  });
});

describe('reversalNote', () => {
  it('names the quantity, where it goes back to, and what gets removed', () => {
    expect(
      reversalNote(
        {
          destType: 'RAW_INVENTORY',
          lines: [
            {
              sourceBatchId: 41,
              destBatchId: 90,
              quantity: 700,
              sourceBatchNumber: 'BATCH-260710-02',
            } as never,
          ],
        },
        'ml',
      ),
    ).toBe('Returns 700 ml to BATCH-260710-02 and removes the created Raw batch.');
  });

  it('sums a multi-hop reversal and counts the batches rather than listing them', () => {
    expect(
      reversalNote(
        {
          destType: 'PRODUCT_INVENTORY',
          lines: [
            { sourceBatchId: 41, destBatchId: 90, quantity: 500 },
            { sourceBatchId: 42, destBatchId: 90, quantity: 200 },
          ],
        },
        'ml',
      ),
    ).toBe('Returns 700 ml to 2 batches and removes the created Product batch.');
  });

  it('promises nothing specific when there is no ledger to back it', () => {
    expect(reversalNote({ id: 4 }, 'ml')).toBeNull();
    expect(reversalNote(null, 'ml')).toBeNull();
  });
});

describe('hop labels', () => {
  it('keeps the pair together so they cannot drift apart in the JSX', () => {
    expect(HOP_SOURCE_LABEL).toBe('Drawn from source batch');
    expect(HOP_DEST_LABEL).toBe('into new destination batch');
  });
});
