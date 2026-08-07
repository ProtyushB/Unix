import {
  baseEquivalence,
  batchName,
  expiryLabel,
  formatBatchDate,
  formatStamp,
  listSubtitle,
  quantityParts,
  toBatchRow,
  type BatchDto,
} from './batch.model';

const TODAY = '2026-08-07';

const batch = (over: Partial<BatchDto> = {}): BatchDto => ({
  id: 1,
  itemId: 9,
  itemName: 'Keratin Smooth Mask',
  batchNumber: 'M-BCH-2026-07-22-011',
  supplierName: 'L’Oréal Pro',
  status: 'ACTIVE',
  purchasedQuantity: 600,
  remainingQuantity: 144,
  stockInUnit: 'box',
  stockInMultiplier: 12,
  expiryDate: '2026-09-30',
  ...over,
});

describe('batchName', () => {
  it('prefers the snapshot, which survives the product being deleted', () => {
    expect(batchName(batch({ productSnapshot: { name: 'Snapshot Name' } }))).toBe('Snapshot Name');
  });

  it('falls back to the denormalised name, then to the id', () => {
    expect(batchName(batch())).toBe('Keratin Smooth Mask');
    expect(batchName(batch({ itemName: null, productSnapshot: null }))).toBe('Product #9');
    // A row is never nameless.
    expect(batchName({ itemName: null, itemId: null })).toBe('Unknown product');
  });

  it('ignores a whitespace-only name rather than rendering a blank row', () => {
    expect(batchName(batch({ itemName: '   ', productSnapshot: null }))).toBe('Product #9');
  });
});

describe('formatBatchDate', () => {
  it('renders the day as written, with no timezone round-trip', () => {
    // `new Date("2026-11-20")` parses as UTC and lands on the 19th for IST users, all day.
    expect(formatBatchDate('2026-11-20')).toBe('20 Nov 2026');
    expect(formatBatchDate('2026-01-05')).toBe('5 Jan 2026');
  });

  it('accepts a full timestamp and an empty value', () => {
    expect(formatBatchDate('2026-11-20T00:00:00Z')).toBe('20 Nov 2026');
    expect(formatBatchDate(null)).toBe('');
    expect(formatBatchDate('')).toBe('');
  });
});

describe('formatStamp', () => {
  it('renders the meridiem in uppercase, whatever the JS engine would do', () => {
    // `toLocaleTimeString('en-IN')` gives lowercase "am" on Chrome and uppercase elsewhere. The
    // mockup is uppercase, and a label that flips with the engine cannot be pinned by a test.
    expect(formatStamp('2026-07-22T10:15:00')).toBe('22 Jul 2026, 10:15 AM');
    expect(formatStamp('2026-08-04T18:30:00')).toBe('4 Aug 2026, 6:30 PM');
  });

  it('calls both noon and midnight 12, not 0', () => {
    expect(formatStamp('2026-07-22T12:00:00')).toBe('22 Jul 2026, 12:00 PM');
    expect(formatStamp('2026-07-22T00:05:00')).toBe('22 Jul 2026, 12:05 AM');
  });

  it('pads the minutes', () => {
    expect(formatStamp('2026-07-22T09:07:00')).toBe('22 Jul 2026, 9:07 AM');
  });

  it('is empty rather than "Invalid Date" for a missing or broken instant', () => {
    expect(formatStamp(null)).toBe('');
    expect(formatStamp('')).toBe('');
    expect(formatStamp('not a date')).toBe('');
  });
});

describe('expiryLabel', () => {
  it('switches tense once the date has passed', () => {
    expect(expiryLabel('2026-09-30', TODAY)).toBe('Expires 30 Sep 2026');
    expect(expiryLabel('2026-07-15', TODAY)).toBe('Expired 15 Jul 2026');
    // Expiring today is already expired — the conservative boundary.
    expect(expiryLabel(TODAY, TODAY)).toBe('Expired 7 Aug 2026');
  });

  it('is empty for a batch with no expiry', () => {
    expect(expiryLabel(null, TODAY)).toBe('');
  });
});

describe('quantityParts', () => {
  it('splits the figure from the rest, so the figure can carry the health colour', () => {
    // Merged into one string it can only be one size and one colour, and the row loses one of its
    // three independent cues.
    expect(quantityParts(batch(), 'sachet')).toEqual({ remaining: '12', of: '/ 50 boxes' });
  });

  it('states the unit ONCE — "12 / 50 boxes", not "12 boxes / 50 boxes"', () => {
    const p = quantityParts(batch(), 'sachet');
    expect(`${p.remaining} ${p.of}`).toBe('12 / 50 boxes');
  });

  it('converts both sides through the SAME level', () => {
    // Rendering remaining in boxes and purchased in sachets would read as a catastrophic loss.
    expect(quantityParts(batch({ stockInUnit: null, stockInMultiplier: null }), 'sachet')).toEqual({
      remaining: '144',
      of: '/ 600 sachets',
    });
  });

  it('handles a zeroed batch', () => {
    expect(quantityParts(batch({ remainingQuantity: 0 }), 'sachet')).toEqual({
      remaining: '0',
      of: '/ 50 boxes',
    });
  });
});

describe('baseEquivalence', () => {
  it('spells out the base count when the stock-in unit is not the base one', () => {
    expect(baseEquivalence(batch(), 'sachet')).toBe('≈ 144 sachets');
  });

  it('says nothing for a base-unit batch, where it would restate the quantity', () => {
    expect(baseEquivalence(batch({ stockInMultiplier: 1 }), 'sachet')).toBeNull();
    expect(baseEquivalence(batch({ stockInUnit: null }), 'sachet')).toBeNull();
  });
});

describe('toBatchRow', () => {
  it('maps the three independent signals a row carries', () => {
    const row = toBatchRow(batch(), 'sachet', TODAY);
    expect(row.status).toBe('ACTIVE');
    expect(row.remainingText).toBe('12');
    expect(row.ofText).toBe('/ 50 boxes');
    expect(row.baseEquivalence).toBe('≈ 144 sachets');
    // 144/600 = 24%, which is above the 20% band → healthy.
    expect(row.remaining).toBe('healthy');
    expect(row.fill).toBeCloseTo(0.24);
    // 54 days out. Under the 30-day rule this is FRESH — it would have been "near" only under the
    // mockup's discarded 90-day legend.
    expect(row.expiry).toBe('fresh');
    expect(row.expiryLabel).toBe('Expires 30 Sep 2026');
    expect(row.expiryCountdown).toBeNull();
  });

  it('carries the countdown once a batch is inside the 30-day window', () => {
    const row = toBatchRow(batch({ expiryDate: '2026-08-27' }), 'sachet', TODAY);
    expect(row.expiry).toBe('near');
    expect(row.expiryCountdown).toBe('20d left');
  });

  it('defaults a missing status to ACTIVE rather than rendering an unstyled pill', () => {
    expect(toBatchRow(batch({ status: null }), 'unit', TODAY).status).toBe('ACTIVE');
  });

  it('shows no countdown on a fresh or expired batch', () => {
    expect(
      toBatchRow(batch({ expiryDate: '2026-12-31' }), 'unit', TODAY).expiryCountdown,
    ).toBeNull();
    expect(
      toBatchRow(batch({ expiryDate: '2026-01-01' }), 'unit', TODAY).expiryCountdown,
    ).toBeNull();
  });
});

describe('listSubtitle', () => {
  it('reads the total when the server reported one', () => {
    expect(listSubtitle(128, false)).toBe('128 batches · sorted by expiry');
    expect(listSubtitle(1, false)).toBe('1 batch · sorted by expiry');
  });

  it('omits the count rather than claiming zero when the total is unknown', () => {
    // A null total means "not reported", which is not the same as none.
    expect(listSubtitle(null, false)).toBe('sorted by expiry');
  });

  it('says so when a filter is narrowing the list', () => {
    expect(listSubtitle(14, true)).toBe('14 batches · filtered');
  });
});
