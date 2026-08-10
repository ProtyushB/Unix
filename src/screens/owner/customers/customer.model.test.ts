import {
  activityLine,
  cardFooterLine,
  contactLine,
  customerName,
  formatDayMonth,
  formatFullDate,
  formatMonthYear,
  formatSpend,
  formatStamp,
  toCustomerRow,
} from './customer.model';

describe('customerName', () => {
  it('joins first and last', () => {
    expect(customerName({ personId: 1, firstName: 'Priya', lastName: 'Sharma' })).toBe(
      'Priya Sharma',
    );
    expect(customerName({ personId: 1, firstName: 'Priya' })).toBe('Priya');
  });

  it('falls back to email, then phone, then the id — never to a blank', () => {
    // A walk-in recorded from a phone number is ordinary; a blank card is unrecognisable and,
    // in practice, untappable.
    expect(customerName({ personId: 1, email: 'p@x.com' })).toBe('p@x.com');
    expect(customerName({ personId: 1, phoneNumber: '+91 98765 43210' })).toBe('+91 98765 43210');
    expect(customerName({ personId: 7 })).toBe('Customer #7');
    expect(customerName({ personId: 7, firstName: '  ', lastName: '  ' })).toBe('Customer #7');
  });
});

describe('contactLine', () => {
  it('joins phone and email', () => {
    expect(contactLine({ personId: 1, phoneNumber: '+91 98765 43210', email: 'p@x.com' })).toBe(
      '+91 98765 43210 · p@x.com',
    );
  });

  it('STATES a missing email rather than dropping it', () => {
    // "no email" is a useful fact about a walk-in, not an absence to hide — and the mockup says so.
    expect(contactLine({ personId: 1, phoneNumber: '+91 98765 43210' })).toBe(
      '+91 98765 43210 · no email',
    );
  });

  it('lets an email stand alone when there is no phone', () => {
    expect(contactLine({ personId: 1, email: 'p@x.com' })).toBe('p@x.com');
    expect(contactLine({ personId: 1 })).toBe('');
  });
});

describe('formatSpend', () => {
  it('drops a trailing .00 but keeps real paise, and groups Indian-style', () => {
    expect(formatSpend(42300)).toBe('₹42,300');
    expect(formatSpend(42300.5)).toBe('₹42,300.50');
    expect(formatSpend(1234567)).toBe('₹12,34,567');
    expect(formatSpend(0)).toBe('₹0');
    expect(formatSpend(null)).toBe('₹0');
  });
});

describe('activityLine', () => {
  it('says "activity", never "visits" or "orders"', () => {
    // Server-side this counts FINALIZED BILLS only. "Visits" would overstate it for a business
    // that bills monthly and understate it for one that does not bill at all.
    expect(activityLine(18)).toBe('18 activity');
    expect(activityLine(1)).toBe('1 activity');
    expect(activityLine(0)).toBe('0 activity');
    expect(activityLine(null)).toBe('0 activity');
  });
});

describe('the date formats', () => {
  const iso = '2026-03-12T09:20:00.000Z';

  it('renders month and year for "customer since"', () => {
    expect(formatMonthYear(iso)).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
  });

  it('renders day and month, no year, for the card', () => {
    expect(formatDayMonth(iso)).toMatch(/^\d{2} [A-Z][a-z]{2}$/);
    expect(formatDayMonth(iso)).not.toMatch(/\d{4}/);
  });

  it('renders the full date for the profile', () => {
    expect(formatFullDate(iso)).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
  });

  it('renders a full stamp with a hand-built meridiem', () => {
    // toLocaleTimeString renders "am" on Chrome and "AM" elsewhere; the case is pinned here.
    expect(formatStamp(iso)).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
  });

  it('renders midnight as 12, not 0', () => {
    const midnight = new Date(Date.parse(iso));
    midnight.setHours(0, 30, 0, 0);
    expect(formatStamp(midnight.toISOString())).toContain('12:30 AM');
  });

  it('answers empty on junk rather than throwing', () => {
    for (const bad of [null, undefined, '', '   ', 'not a date']) {
      expect(formatMonthYear(bad)).toBe('');
      expect(formatDayMonth(bad)).toBe('');
      expect(formatFullDate(bad)).toBe('');
      expect(formatStamp(bad)).toBe('');
    }
  });
});

describe('toCustomerRow', () => {
  const dto = {
    personId: 42,
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya@mail.com',
    phoneNumber: '+91 98765 43210',
    totalSpent: 42300,
    activityCount: 18,
    firstSeenAt: '2025-03-12T09:20:00.000Z',
    lastActivityAt: '2026-08-04T12:50:00.000Z',
  };

  it('keys on personId, NOT id — this projection is over Person, not a Person', () => {
    expect(toCustomerRow(dto).personId).toBe(42);
  });

  it('shapes every string a card renders', () => {
    const row = toCustomerRow(dto);
    expect(row.name).toBe('Priya Sharma');
    expect(row.initials).toBe('PS');
    expect(row.contact).toBe('+91 98765 43210 · priya@mail.com');
    expect(row.totalSpentText).toBe('₹42,300');
    expect(row.activityText).toBe('18 activity');
    expect(row.sinceText).toMatch(/^Since [A-Z][a-z]{2} \d{4}$/);
    expect(row.lastActiveText).toMatch(/^Last active \d{2} [A-Z][a-z]{2}$/);
    expect(row.raw).toBe(dto);
  });

  it('omits a prefix rather than writing "Since " with nothing after it', () => {
    const row = toCustomerRow({ personId: 1 });
    expect(row.sinceText).toBe('');
    expect(row.lastActiveText).toBe('');
  });
});

describe('cardFooterLine', () => {
  it('collapses either missing half', () => {
    expect(cardFooterLine({ sinceText: 'Since Mar 2025', lastActiveText: 'Last active 04 Aug' })).toBe(
      'Since Mar 2025 · Last active 04 Aug',
    );
    expect(cardFooterLine({ sinceText: 'Since Mar 2025', lastActiveText: '' })).toBe(
      'Since Mar 2025',
    );
    expect(cardFooterLine({ sinceText: '', lastActiveText: '' })).toBe('');
  });
});
