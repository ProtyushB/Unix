import {
  customerNameOf,
  dayKeyOf,
  dayLabelOf,
  formatAmount,
  formatOrderDate,
  formatOrderStamp,
  itemStatusLabel,
  statusLabel,
  timeOf,
  toOrderRow,
} from './order.model';

describe('customerNameOf', () => {
  it('prefers the split name the enriched DTO carries', () => {
    expect(customerNameOf({ customerFirstName: 'Anjali', customerLastName: 'Rao' })).toBe(
      'Anjali Rao',
    );
  });

  it('takes whichever half exists rather than rendering a stray space', () => {
    expect(customerNameOf({ customerFirstName: 'Anjali' })).toBe('Anjali');
    expect(customerNameOf({ customerLastName: 'Rao' })).toBe('Rao');
    expect(customerNameOf({ customerFirstName: '  ', customerLastName: 'Rao' })).toBe('Rao');
  });

  it('falls through to the flattened fields other producers send', () => {
    expect(customerNameOf({ customerName: 'Rahul Mehta' })).toBe('Rahul Mehta');
    expect(customerNameOf({ customer: 'Priya Nair' })).toBe('Priya Nair');
  });

  it('never renders an empty customer', () => {
    expect(customerNameOf({})).toBe('Unknown Customer');
    expect(customerNameOf(null)).toBe('Unknown Customer');
  });
});

describe('toOrderRow', () => {
  const raw = {
    id: 42,
    orderNumber: 'ORD-05082026-042',
    customerFirstName: 'Rahul',
    customerLastName: 'Mehta',
    customerPhoneNumber: '+91 98765 43210',
    customerEmail: 'rahul@mail.com',
    totalAmount: 626,
    orderStatus: 'CONFIRMED',
    orderDate: '2026-08-05T08:44:00Z',
  };

  it('reads orderStatus and orderDate, not status and date', () => {
    // The DTO mirrors the web portal's field names. Reading `status`/`date` yields undefined and
    // silently falls back to PENDING/null, which looks like real data.
    const row = toOrderRow(raw, 0);
    expect(row.status).toBe('CONFIRMED');
    expect(row.when).toBe('2026-08-05T08:44:00Z');
  });

  it('maps the rest of the row', () => {
    const row = toOrderRow(raw, 0);
    expect(row).toMatchObject({
      id: 42,
      customerName: 'Rahul Mehta',
      orderNumber: 'ORD-05082026-042',
      amount: 626,
      phone: '+91 98765 43210',
      email: 'rahul@mail.com',
    });
  });

  it('defaults a missing status to PENDING and a missing amount to zero', () => {
    const row = toOrderRow({ id: 1 }, 0);
    expect(row.status).toBe('PENDING');
    expect(row.amount).toBe(0);
    expect(row.when).toBeNull();
  });

  it('falls back to createdAt when the order has no orderDate', () => {
    expect(toOrderRow({ id: 1, createdAt: '2026-08-05T08:00:00Z' }, 0).when).toBe(
      '2026-08-05T08:00:00Z',
    );
  });

  it('uses the row index as an id only when the DTO has none', () => {
    expect(toOrderRow({ orderNumber: 'ORD-1' }, 7).id).toBe(7);
  });

  it('leaves phone and email undefined rather than empty, so callers can ?? them', () => {
    const row = toOrderRow({ id: 1 }, 0);
    expect(row.phone).toBeUndefined();
    expect(row.email).toBeUndefined();
  });
});

describe('formatAmount', () => {
  it('drops .00 but keeps real paise', () => {
    expect(formatAmount(2450)).toBe('₹2,450');
    expect(formatAmount(2450.5)).toBe('₹2,450.50');
    expect(formatAmount(0)).toBe('₹0');
  });
});

describe('statusLabel', () => {
  it('title-cases a known status and passes an unknown one straight through', () => {
    expect(statusLabel('CONFIRMED')).toBe('Confirmed');
    expect(statusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(statusLabel(null)).toBe('');
  });

  it('covers the item statuses, which are a longer set than the order-level ones', () => {
    expect(itemStatusLabel('DELIVERED')).toBe('Delivered');
    expect(itemStatusLabel('RETURNED')).toBe('Returned');
    expect(itemStatusLabel('PREPARING')).toBe('Preparing');
    expect(itemStatusLabel(undefined)).toBe('');
  });
});

describe('dates', () => {
  // 5 Aug 2026, 14:14 local.
  const iso = new Date(2026, 7, 5, 14, 14).toISOString();

  it('formats the time half of the meta line', () => {
    expect(timeOf(iso)).toBe('2:14 PM');
    expect(timeOf(new Date(2026, 7, 5, 0, 5).toISOString())).toBe('12:05 AM');
    expect(timeOf(new Date(2026, 7, 5, 12, 0).toISOString())).toBe('12:00 PM');
  });

  it('returns empty for a missing or unparseable timestamp rather than "Invalid Date"', () => {
    expect(timeOf(null)).toBe('');
    expect(timeOf('not a date')).toBe('');
    expect(formatOrderDate('not a date')).toBe('');
    expect(formatOrderStamp(null)).toBe('');
  });

  it('buckets rows by calendar day, with one key for everything undated', () => {
    expect(dayKeyOf(iso)).toBe('2026-7-5');
    expect(dayKeyOf(new Date(2026, 7, 5, 23, 59).toISOString())).toBe('2026-7-5');
    expect(dayKeyOf(null)).toBe('undated');
    expect(dayKeyOf('nonsense')).toBe('undated');
  });

  it('labels the three relative days and falls back to a bare stamp', () => {
    const now = new Date(2026, 7, 5, 9, 0);
    expect(dayLabelOf(new Date(2026, 7, 5, 14, 0).toISOString(), now)).toBe('TODAY · 5 AUG');
    expect(dayLabelOf(new Date(2026, 7, 4, 14, 0).toISOString(), now)).toBe('YESTERDAY · 4 AUG');
    expect(dayLabelOf(new Date(2026, 7, 6, 14, 0).toISOString(), now)).toBe('TOMORROW · 6 AUG');
    expect(dayLabelOf(new Date(2026, 7, 1, 14, 0).toISOString(), now)).toBe('1 AUG');
    expect(dayLabelOf(null, now)).toBe('UNDATED');
  });

  it('labels relative days by calendar date, not by elapsed hours', () => {
    // 23:30 today and 00:30 tomorrow are an hour apart but must read as different days.
    const now = new Date(2026, 7, 5, 23, 30);
    expect(dayLabelOf(new Date(2026, 7, 6, 0, 30).toISOString(), now)).toBe('TOMORROW · 6 AUG');
  });

  it('formats the detail screen title date and system stamp', () => {
    expect(formatOrderDate(iso)).toBe('5 Aug 2026');
    expect(formatOrderStamp(iso)).toBe('5 Aug 2026, 2:14 PM');
  });
});
