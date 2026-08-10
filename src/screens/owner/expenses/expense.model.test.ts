import {
  cardCategoryLine,
  cardMetaLine,
  expenseTitle,
  formatAmount,
  formatExpenseDay,
  formatExpenseStamp,
  formatExpenseStampLong,
  hasReceipt,
  toExpenseRow,
} from './expense.model';

describe('formatAmount', () => {
  it('drops a trailing .00 but keeps real paise', () => {
    // The mockups draw whole rupees; formatCurrency always writes two decimals. Both have to be
    // true, so the trim is conditional rather than a slice.
    expect(formatAmount(8450)).toBe('₹8,450');
    expect(formatAmount(8450.5)).toBe('₹8,450.50');
    expect(formatAmount(45000)).toBe('₹45,000');
  });

  it('groups in the Indian style, and handles zero and null', () => {
    expect(formatAmount(1234567)).toBe('₹12,34,567');
    expect(formatAmount(0)).toBe('₹0');
    expect(formatAmount(null)).toBe('₹0');
    expect(formatAmount(undefined)).toBe('₹0');
  });
});

describe('the timestamps', () => {
  // A fixed instant. These render in the DEVICE's zone — which is what every other card in the app
  // does — so the assertions below are written against the runner's zone via a round trip rather
  // than hardcoding a wall clock the CI box may not share.
  const iso = '2026-08-04T11:40:00.000Z';
  const local = new Date(Date.parse(iso));

  it('writes the short stamp with no year', () => {
    const out = formatExpenseStamp(iso);
    expect(out).toMatch(/^\d{2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/);
    expect(out).not.toContain(String(local.getFullYear()));
  });

  it('pads the day and builds the meridiem by hand', () => {
    // toLocaleTimeString renders "am" on Chrome and "AM" elsewhere; the case is pinned here.
    expect(formatExpenseStamp('2026-08-04T00:05:00.000Z')).toMatch(/(AM|PM)$/);
    expect(formatExpenseStamp(iso).slice(0, 2)).toMatch(/^\d{2}$/);
  });

  it('renders midnight as 12, not 0', () => {
    // Local midnight, whatever zone the runner is in.
    const midnight = new Date(local);
    midnight.setHours(0, 30, 0, 0);
    expect(formatExpenseStamp(midnight.toISOString())).toContain('12:30 AM');
  });

  it('renders noon as 12 PM', () => {
    const noon = new Date(local);
    noon.setHours(12, 15, 0, 0);
    expect(formatExpenseStamp(noon.toISOString())).toContain('12:15 PM');
  });

  it('puts the YEAR after the month in the long form, not on the end', () => {
    const long = formatExpenseStampLong(iso);
    expect(long).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
    expect(long).toContain(String(local.getFullYear()));
  });

  it('gives the day alone for the app-bar subtitle', () => {
    expect(formatExpenseDay(iso)).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
    expect(formatExpenseDay(iso)).not.toMatch(/(AM|PM)/);
  });

  it('answers empty on junk rather than throwing — one bad stamp cannot blank a list', () => {
    for (const bad of [null, undefined, '', '   ', 'not a date']) {
      expect(formatExpenseStamp(bad)).toBe('');
      expect(formatExpenseStampLong(bad)).toBe('');
      expect(formatExpenseDay(bad)).toBe('');
    }
  });
});

describe('expenseTitle', () => {
  it('falls back to the id rather than a blank', () => {
    // A blank card looks like a rendering fault, and the row still has to be tappable to delete.
    expect(expenseTitle({ id: 7, title: 'CCTV repair' })).toBe('CCTV repair');
    expect(expenseTitle({ id: 7, title: '   ' })).toBe('Expense #7');
    expect(expenseTitle({ id: 7 })).toBe('Expense #7');
  });
});

describe('hasReceipt', () => {
  it('is true only for a non-empty list', () => {
    expect(hasReceipt({ files: [{ dmsFileId: 1 }] })).toBe(true);
    expect(hasReceipt({ files: [] })).toBe(false);
    expect(hasReceipt({})).toBe(false);
    expect(hasReceipt({ files: null })).toBe(false);
  });
});

describe('toExpenseRow', () => {
  const dto = {
    id: 12,
    title: 'CCTV repair',
    amount: 3200,
    category: 'MAINTENANCE_REPAIR' as const,
    vendorName: 'SecureTech',
    paymentMethod: 'UPI' as const,
    expenseDate: '2026-08-04T11:40:00.000Z',
    reimbursable: true,
    reimbursed: false,
    files: [{ dmsFileId: 5 }],
  };

  it('shapes every string a card renders', () => {
    const row = toExpenseRow(dto);
    expect(row.id).toBe(12);
    expect(row.title).toBe('CCTV repair');
    expect(row.amountText).toBe('₹3,200');
    expect(row.categoryText).toBe('Maintenance & Repair');
    expect(row.vendor).toBe('SecureTech');
    expect(row.paymentText).toBe('UPI');
    expect(row.hasReceipt).toBe(true);
    expect(row.raw).toBe(dto);
  });

  it('uses the FULL category label, not the shortened chip form', () => {
    // The mockup's card once read "Maintenance"; the enum's label is "Maintenance & Repair", and
    // the short form names a bucket that does not exist.
    expect(toExpenseRow(dto).categoryText).toBe('Maintenance & Repair');
  });

  it('derives the reimbursement state from the two booleans', () => {
    expect(toExpenseRow(dto).reimbursement).toBe('PENDING');
    expect(toExpenseRow({ ...dto, reimbursed: true }).reimbursement).toBe('SETTLED');
    expect(toExpenseRow({ ...dto, reimbursable: false }).reimbursement).toBe('NOT_REIMBURSABLE');
  });
});

describe('the card lines', () => {
  it('drops the vendor half entirely when absent, rather than showing a dash', () => {
    // A category on its own is a complete statement; "Rent / Lease · —" invites the reader to
    // wonder what is missing.
    expect(cardCategoryLine({ categoryText: 'Rent / Lease', vendor: '' })).toBe('Rent / Lease');
    expect(cardCategoryLine({ categoryText: 'Utilities', vendor: 'Tata Power' })).toBe(
      'Utilities · Tata Power',
    );
  });

  it('drops an unspecified payment method from the meta line', () => {
    // paymentMethodLabel returns "—" for absence, which is right in a label/value row on the detail
    // screen and wrong in a run-on line where it would read as a missing date.
    expect(cardMetaLine({ whenText: '04 Aug', paymentText: '—' })).toBe('04 Aug');
    expect(cardMetaLine({ whenText: '04 Aug', paymentText: 'UPI' })).toBe('04 Aug · UPI');
    expect(cardMetaLine({ whenText: '', paymentText: 'UPI' })).toBe('UPI');
  });
});
