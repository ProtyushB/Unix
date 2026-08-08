import type { ConsumptionDeduction } from '../../../backend/modules/shared/consumption.types';
import {
  batchText,
  cardMetaLine,
  consumptionName,
  formatShortStamp,
  listSubtitle,
  recordQtyParts,
  toConsumptionRow,
} from './consumption.model';

describe('consumptionName', () => {
  it('prefers the denormalised name, which is why it is denormalised', () => {
    // A consumption outlives the product it was recorded against — exactly when a name matters most.
    expect(consumptionName({ itemName: 'Bleach Powder', itemId: 21 })).toBe('Bleach Powder');
  });

  it('falls back to the id rather than rendering a nameless row', () => {
    expect(consumptionName({ itemId: 21 })).toBe('Product #21');
    expect(consumptionName({ itemName: '   ', itemId: 21 })).toBe('Product #21');
    expect(consumptionName({})).toBe('Unknown product');
  });
});

describe('toConsumptionRow', () => {
  it('renders a mixed quantity as its breakdown', () => {
    const row = toConsumptionRow(
      {
        id: 5,
        itemName: 'Bleach Powder',
        quantity: 45,
        unitName: null,
        unitLines: [
          { unit: 'scoop', perStock: 30, qty: 1 },
          { unit: 'g', perStock: 1, qty: 15 },
        ],
      },
      'g',
    );
    expect(row.qtyText).toBe('1 scoop · 15 g');
  });

  it('renders a single-level quantity from the scalar and its unit', () => {
    const row = toConsumptionRow({ quantity: 2, unitName: 'bottle', unitLines: null }, 'ml');
    expect(row.qtyText).toBe('2 bottles');
  });

  it('reports an ABSENT ledger as null, never as zero', () => {
    // A list row carries no `deductions` — the server only enriches the detail read. "0 batches"
    // would claim the consumption drew from nothing, which is a different and false statement.
    expect(toConsumptionRow({ id: 5 }).batchCount).toBeNull();
    expect(toConsumptionRow({ id: 5, deductions: [] }).batchCount).toBe(0);
    expect(toConsumptionRow({ id: 5, deductions: [{ batchId: 1, qty: 30 }] }).batchCount).toBe(1);
  });

  it('leaves the reason as the raw enum for the view layer to label', () => {
    expect(toConsumptionRow({ reason: 'SERVICE_USE' }).reason).toBe('SERVICE_USE');
    expect(toConsumptionRow({}).reason).toBeNull();
  });

  it('renders an empty timestamp rather than an Invalid Date', () => {
    expect(toConsumptionRow({}).whenText).toBe('');
    expect(toConsumptionRow({ consumedAt: 'not-a-date' }).whenText).toBe('');
  });
});

describe('formatShortStamp', () => {
  it('renders the board’s "05 Aug, 5:10 PM" — zero-padded day, NO year, uppercase meridiem', () => {
    // Not `formatStamp`, which renders "22 Jul 2026, 10:15 AM". This list is read newest-first, so
    // the year is noise on every row; the day is padded because a column of "5 Aug" / "12 Aug"
    // reads ragged.
    expect(formatShortStamp('2026-08-05T17:10:00')).toBe('05 Aug, 5:10 PM');
    expect(formatShortStamp('2026-08-05T09:05:00')).toBe('05 Aug, 9:05 AM');
  });

  it('handles both ends of the 12-hour clock, where `% 12` alone gives a nonsense 0', () => {
    expect(formatShortStamp('2026-08-05T00:30:00')).toBe('05 Aug, 12:30 AM');
    expect(formatShortStamp('2026-08-05T12:00:00')).toBe('05 Aug, 12:00 PM');
  });

  it('renders empty rather than an Invalid Date', () => {
    expect(formatShortStamp(null)).toBe('');
    expect(formatShortStamp('')).toBe('');
    expect(formatShortStamp('not-a-date')).toBe('');
  });
});

describe('batchText', () => {
  it('prefers a batch number the record carries itself', () => {
    expect(batchText({ batchNumber: 'BATCH-260722-03' })).toBe('BATCH-260722-03');
  });

  it('names the single batch a FEFO draw came out of', () => {
    // Cast because `ConsumptionDeduction` promises `{batchId, qty}` only — the printed number is an
    // enrichment the detail read may add, which is exactly why `batchText` reads it defensively.
    const enriched = {
      batchId: 14,
      batchNumber: 'BATCH-260722-03',
      qty: 45,
    } as ConsumptionDeduction;
    expect(batchText({ deductions: [enriched] })).toBe('BATCH-260722-03');
  });

  it('falls back to the id when only the ledger id is known', () => {
    // `ConsumptionDeduction` promises `{batchId, qty}` and nothing else, so the printed number is
    // read defensively. An id beats a blank.
    expect(batchText({ deductions: [{ batchId: 14, qty: 45 }] })).toBe('Batch #14');
  });

  it('COUNTS a split draw rather than naming one of the batches', () => {
    // FEFO can split across batches. Claiming one reference for a quantity that came out of three
    // is a lie the user cannot detect.
    expect(
      batchText({
        deductions: [
          { batchId: 14, qty: 30 },
          { batchId: 15, qty: 15 },
        ],
      }),
    ).toBe('2 batches');
  });

  it('is EMPTY for a list row, which carries no ledger at all', () => {
    // The common case, not an error — `/byBusiness` does not enrich `deductions`.
    expect(batchText({ id: 5 })).toBe('');
    expect(batchText({ id: 5, deductions: [] })).toBe('');
    expect(batchText(null)).toBe('');
  });
});

describe('recordQtyParts', () => {
  it('reads a MIXED record’s quantity as already-base, in the ladder’s base rung', () => {
    // The silent overcount this pins: 45 × 30 = 1350, printed as "restocks 1350 g" with nothing on
    // screen to say it is thirty times wrong.
    expect(
      recordQtyParts({
        quantity: 45,
        unitMultiplier: 1,
        unitLines: [
          { unit: 'scoop', perStock: 30, qty: 1 },
          { unit: 'g', perStock: 1, qty: 15 },
        ],
      }),
    ).toEqual({ value: 45, unit: 'g' });
  });

  it('leaves a SINGLE-level record in the units the user typed', () => {
    // "60 g" would be a number they never entered. "2 scoops" is what they said.
    expect(recordQtyParts({ quantity: 2, unitName: 'scoop', unitMultiplier: 30 })).toEqual({
      value: 2,
      unit: 'scoop',
    });
  });

  it('falls back to a unit word rather than rendering a figure with a hole beside it', () => {
    expect(recordQtyParts({ quantity: 45 })).toEqual({ value: 45, unit: 'unit' });
    expect(recordQtyParts({ quantity: 45 }, 'g')).toEqual({ value: 45, unit: 'g' });
  });

  it('is null — never 0 — for a record carrying no quantity', () => {
    // "restocks 0 g" is a sentence that should never print.
    expect(recordQtyParts({}).value).toBeNull();
    expect(recordQtyParts({ quantity: null }).value).toBeNull();
    expect(recordQtyParts(null).value).toBeNull();
  });
});

describe('cardMetaLine', () => {
  it('joins the stamp and the batch with the separator this app uses for quantities', () => {
    expect(cardMetaLine({ whenText: '05 Aug, 5:10 PM', batchText: 'BATCH-260722-03' })).toBe(
      '05 Aug, 5:10 PM · BATCH-260722-03',
    );
  });

  it('degrades to a bare timestamp rather than leaving a dangling separator', () => {
    expect(cardMetaLine({ whenText: '05 Aug, 5:10 PM', batchText: '' })).toBe('05 Aug, 5:10 PM');
    expect(cardMetaLine({ whenText: '', batchText: 'BATCH-260722-03' })).toBe('BATCH-260722-03');
    expect(cardMetaLine({ whenText: '', batchText: '' })).toBe('');
  });

  it('never uses `+` — one separator for one concept, app-wide', () => {
    expect(cardMetaLine({ whenText: '05 Aug, 5:10 PM', batchText: '2 batches' })).not.toContain(
      '+',
    );
  });
});

describe('listSubtitle', () => {
  it('NEVER claims a record count', () => {
    // `/byBusiness` returns `totalPages` and nothing else; there is no row count to show. This test
    // is the tripwire — if someone wires a number in here, it came from a guess.
    expect(listSubtitle(false)).not.toMatch(/\d/);
    expect(listSubtitle(true)).not.toMatch(/\d/);
  });

  it('says so when the list is narrowed', () => {
    expect(listSubtitle(true)).toMatch(/filtered/i);
  });

  it('is the board’s phrase, with a tail only when there is something to say', () => {
    expect(listSubtitle(false)).toBe('Raw stock usage');
    expect(listSubtitle(true)).toBe('Raw stock usage · filtered');
  });
});
