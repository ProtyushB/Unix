import { consumptionName, listSubtitle, toConsumptionRow } from './consumption.model';

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
});
