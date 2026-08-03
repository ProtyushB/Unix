import {
  toBillRow,
  billDayKey,
  istToday,
  formatAmount,
  formatCompactAmount,
  billsHeaderLine,
  billSectionTitle,
  groupBillsByDay,
  type BillRow,
} from './bill.model';

describe('billDayKey', () => {
  // billDate is a real instant with an offset, unlike an appointment's zone-less wall clock.
  // Slicing the ISO string would give the UTC day, which is the PREVIOUS day for anything before
  // 05:30 IST — so an early-morning bill would file itself under yesterday.
  it('uses the IST calendar day, not the UTC one', () => {
    expect(billDayKey('2026-04-22T20:00:00Z')).toBe('2026-04-23'); // 01:30 IST next day
    expect(billDayKey('2026-04-22T18:31:00Z')).toBe('2026-04-23'); // 00:01 IST next day
    expect(billDayKey('2026-04-22T18:29:00Z')).toBe('2026-04-22'); // 23:59 IST same day
  });

  it('is blank for a missing or unparseable date', () => {
    expect(billDayKey(undefined)).toBe('');
    expect(billDayKey('not a date')).toBe('');
  });
});

describe('istToday', () => {
  // Every assertion here pins an explicit UTC instant, so the result cannot depend on the timezone
  // of the machine running the test — CI is usually UTC, a dev box usually is not, and a helper
  // whose test only passes on one of them is worse than no test.
  it('reports the IST day, not the UTC one, in the small hours', () => {
    // 20:00 UTC on the 22nd is already 01:30 IST on the 23rd.
    expect(istToday(new Date('2026-04-22T20:00:00Z'))).toBe('2026-04-23');
  });

  it('agrees with billDayKey by construction', () => {
    // The two must never answer in different timezones — a row filed on the 23rd being compared
    // against a "today" of the 22nd is what makes a bill render 23 APR instead of TODAY.
    const instant = '2026-04-22T18:31:00Z';
    expect(istToday(new Date(instant))).toBe(billDayKey(instant));
  });

  it('holds the same day right up to IST midnight', () => {
    expect(istToday(new Date('2026-04-22T18:29:00Z'))).toBe('2026-04-22'); // 23:59 IST
    expect(istToday(new Date('2026-04-22T18:30:00Z'))).toBe('2026-04-23'); // 00:00 IST
  });
});

describe('toBillRow', () => {
  it('maps a full bill', () => {
    const row = toBillRow({
      id: 33,
      billNumber: 'BILL-10072026-001',
      customerName: 'SAYAK DAS',
      billDate: '2026-07-10T07:50:00Z',
      grandTotal: 305.62,
      paidAmount: 100,
      refundedAmount: 0,
      billStatus: 'FINALIZED',
      paymentStatus: 'PARTIALLY_PAID',
    });

    expect(row.id).toBe(33);
    expect(row.customerName).toBe('SAYAK DAS');
    expect(row.date).toBe('2026-07-10');
    expect(row.amount).toBeCloseTo(305.62);
    expect(row.balance).toBeCloseTo(205.62);
  });

  it('names an unlinked walk-in rather than rendering a blank', () => {
    expect(toBillRow({ customerName: '   ' }).customerName).toBe('Walk-in');
    expect(toBillRow({}).customerName).toBe('Walk-in');
  });

  it('defaults the statuses a legacy row may not carry', () => {
    const row = toBillRow({ id: 1 });
    expect(row.billStatus).toBe('DRAFT');
    expect(row.paymentStatus).toBe('UNPAID');
  });

  it('coerces string amounts', () => {
    // BigDecimal can serialise as a string depending on the mapper.
    const row = toBillRow({ grandTotal: '500.00', paidAmount: '200.00' });
    expect(row.amount).toBe(500);
    expect(row.balance).toBe(300);
  });

  // An over-payment or a fully-refunded bill must not report a negative debt.
  it('floors the balance at zero', () => {
    expect(toBillRow({ grandTotal: 100, paidAmount: 150 }).balance).toBe(0);
    expect(toBillRow({ grandTotal: 100, refundedAmount: 100 }).balance).toBe(0);
  });
});

describe('formatting', () => {
  it('groups row amounts the Indian way', () => {
    expect(formatAmount(2450)).toBe('₹2,450');
    expect(formatAmount(1234567)).toBe('₹12,34,567');
  });

  // The header fits a count and a figure on one line; the wallet card fits three side by side.
  it('compacts big figures in thousands, lakh and crore', () => {
    expect(formatCompactAmount(18750)).toBe('₹18.8K');
    expect(formatCompactAmount(42000)).toBe('₹42K');
    expect(formatCompactAmount(250000)).toBe('₹2.5L');
    expect(formatCompactAmount(30000000)).toBe('₹3Cr');
    expect(formatCompactAmount(950)).toBe('₹950');
  });

  it('drops the outstanding clause when nothing is owed', () => {
    // "₹0 outstanding" reads as a balance to chase; a settled business has nothing to say.
    expect(billsHeaderLine(41, 18750)).toBe('41 bills · ₹18.8K outstanding');
    expect(billsHeaderLine(41, 0)).toBe('41 bills');
    expect(billsHeaderLine(1, 0)).toBe('1 bill');
  });
});

describe('day sections', () => {
  const TODAY = '2026-04-22';

  it('names today and yesterday, then falls back to the date', () => {
    expect(billSectionTitle('2026-04-22', TODAY)).toBe('TODAY');
    expect(billSectionTitle('2026-04-21', TODAY)).toBe('YESTERDAY');
    expect(billSectionTitle('2026-04-20', TODAY)).toBe('20 APR');
  });

  it('handles yesterday across a month boundary', () => {
    expect(billSectionTitle('2026-04-30', '2026-05-01')).toBe('YESTERDAY');
    expect(billSectionTitle('2026-12-31', '2027-01-01')).toBe('YESTERDAY');
  });

  const row = (id: number, date: string): BillRow => ({
    id,
    billNumber: `B-${id}`,
    customerName: 'X',
    date,
    amount: 0,
    billStatus: 'DRAFT',
    paymentStatus: 'UNPAID',
    balance: 0,
  });

  it('groups adjacent days and preserves server order', () => {
    const groups = groupBillsByDay(
      [row(1, '2026-04-22'), row(2, '2026-04-22'), row(3, '2026-04-21')],
      TODAY,
    );

    expect(groups.map((g) => g.title)).toEqual(['TODAY', 'YESTERDAY']);
    expect(groups[0].data.map((r) => r.id)).toEqual([1, 2]);
    expect(groups[1].data.map((r) => r.id)).toEqual([3]);
  });

  it('returns nothing for an empty list', () => {
    expect(groupBillsByDay([], TODAY)).toEqual([]);
  });
});
