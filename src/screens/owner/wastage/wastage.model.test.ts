import { listSubtitle, notesSnippet, toWastageRow, wastageName } from './wastage.model';

describe('wastageName', () => {
  it('prefers the denormalised name, which is why it is denormalised', () => {
    // A wastage outlives the product it was recorded against — exactly when a name matters most.
    expect(wastageName({ itemName: 'Vitamin C Serum', itemId: 21 })).toBe('Vitamin C Serum');
  });

  it('falls back to the id rather than rendering a nameless row', () => {
    expect(wastageName({ itemId: 21 })).toBe('Product #21');
    expect(wastageName({ itemName: '   ', itemId: 21 })).toBe('Product #21');
    expect(wastageName({})).toBe('Unknown product');
  });
});

describe('toWastageRow', () => {
  it('renders a mixed quantity as its breakdown', () => {
    const row = toWastageRow(
      {
        quantity: 600,
        unitName: null,
        unitLines: [
          { unit: 'bottle', perStock: 500, qty: 1 },
          { unit: 'ml', perStock: 1, qty: 100 },
        ],
      },
      'ml',
    );
    expect(row.qtyText).toBe('1 bottle · 100 ml');
  });

  it('carries the pool through and NEVER guesses one', () => {
    // Wastage is the only one of the three that spans both pools. Defaulting to PRODUCT would put
    // the loss against the wrong stock in every read of the row.
    expect(toWastageRow({ inventoryType: 'RAW_INVENTORY' }).inventoryType).toBe('RAW_INVENTORY');
    expect(toWastageRow({}).inventoryType).toBeNull();
  });

  it('reports an ABSENT ledger as null, never as zero', () => {
    // A list row carries no `deductions` — the server only enriches the detail read. "0 batches"
    // would claim the write-off took stock from nothing.
    expect(toWastageRow({}).batchCount).toBeNull();
    expect(toWastageRow({ deductions: [] }).batchCount).toBe(0);
    expect(toWastageRow({ deductions: [{ batchId: 1, qty: 30 }] }).batchCount).toBe(1);
  });

  it('reads the timestamp off `reportedAt`, not off a consumption field', () => {
    // The three features stamp three differently-named columns: consumedAt / reportedAt /
    // transferredAt. Reading the wrong one renders an empty date on every row.
    const row = toWastageRow({ reportedAt: '2026-07-22T10:15:00' });
    expect(row.whenText).toContain('22 Jul 2026');
    expect(toWastageRow({ consumedAt: '2026-07-22T10:15:00' }).whenText).toBe('');
  });

  it('leaves the reason as the raw enum for the view layer to label', () => {
    expect(toWastageRow({ reason: 'EXPIRED' }).reason).toBe('EXPIRED');
    // Including CORRECTION, which no chip offers but a record can carry.
    expect(toWastageRow({ reason: 'CORRECTION' }).reason).toBe('CORRECTION');
    expect(toWastageRow({}).reason).toBeNull();
  });
});

describe('listSubtitle', () => {
  it('NEVER claims a record count', () => {
    // `/byBusiness` returns `totalPages` and nothing else, and there is no money total either.
    expect(listSubtitle(false)).not.toMatch(/\d/);
    expect(listSubtitle(true)).not.toMatch(/\d/);
    expect(listSubtitle(true, 'asc')).not.toMatch(/\d/);
  });

  it('says so when the list is narrowed', () => {
    expect(listSubtitle(true)).toMatch(/filtered/i);
    expect(listSubtitle(false)).toMatch(/Stock written off/);
  });

  it('reports the order it is ACTUALLY in, not a hardcoded "newest first"', () => {
    // The sheet can flip the list to ascending, so the one figure this subtitle is allowed to
    // state was also the one it used to get wrong.
    expect(listSubtitle(false, 'desc')).toContain('newest first');
    expect(listSubtitle(false, 'asc')).toContain('oldest first');
    expect(listSubtitle(true, 'asc')).toBe('Filtered · oldest first');
  });
});

describe('notesSnippet', () => {
  it('keeps a short note whole', () => {
    expect(notesSnippet('Left in the sun')).toBe('Left in the sun');
  });

  it('collapses newlines, so a pasted note is not cut at its first line break', () => {
    expect(notesSnippet('Left in\nthe sun')).toBe('Left in the sun');
  });

  it('truncates a long note with a single ellipsis character', () => {
    const snippet = notesSnippet('x'.repeat(80));
    expect(snippet).toHaveLength(49);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('treats whitespace-only and non-strings as no note at all', () => {
    expect(notesSnippet('   ')).toBe('');
    expect(notesSnippet(null)).toBe('');
    expect(notesSnippet(undefined)).toBe('');
    expect(notesSnippet(42)).toBe('');
  });
});

describe('toWastageRow — the note', () => {
  it('carries the note onto the row so the card need not reach into the DTO', () => {
    expect(toWastageRow({ notes: 'Left in the sun' }).notesSnippet).toBe('Left in the sun');
    expect(toWastageRow({}).notesSnippet).toBe('');
  });
});
