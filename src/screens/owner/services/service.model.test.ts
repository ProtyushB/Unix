import {
  toServiceRow,
  availabilityStateFor,
  formatDuration,
  formatPrice,
  servicesHeaderLine,
  servicesResultLine,
  serviceTintIndex,
  AVAILABILITY_LABEL,
  AVAILABILITY_TINT,
  type ServiceRow,
} from './service.model';

const row = (over: Partial<ServiceRow> = {}): ServiceRow => ({
  id: 1,
  name: 'Hair Spa Treatment',
  description: 'Deep conditioning with steam',
  price: 1500,
  duration: 90,
  availability: true,
  ...over,
});

describe('toServiceRow', () => {
  it('maps a full service', () => {
    const r = toServiceRow({
      id: 7,
      name: 'Bridal Makeup Package',
      description: 'Full bridal look',
      price: 15000,
      duration: 180,
      availability: true,
    });

    expect(r).toEqual({
      id: 7,
      name: 'Bridal Makeup Package',
      description: 'Full bridal look',
      price: 15000,
      duration: 180,
      availability: true,
    });
  });

  // The form treats 0 and blank alike and sends null, so a 0 here would mean "zero minutes".
  it('preserves a null duration rather than coercing it to zero', () => {
    expect(toServiceRow({duration: null}).duration).toBeNull();
    expect(toServiceRow({}).duration).toBeNull();
    expect(toServiceRow({duration: ''}).duration).toBeNull();
    expect(toServiceRow({duration: 45}).duration).toBe(45);
  });

  // The column is NOT NULL DEFAULT true; only an explicit false means unavailable.
  it('treats a missing availability as available', () => {
    expect(toServiceRow({}).availability).toBe(true);
    expect(toServiceRow({availability: false}).availability).toBe(false);
    expect(toServiceRow({availability: true}).availability).toBe(true);
  });

  // A description is up to 1000 characters server-side and the row gives it one line; an embedded
  // newline would otherwise blow the row height out.
  it('collapses whitespace in the description to keep it one line', () => {
    expect(toServiceRow({description: 'Wash,\n  cut\tand   blow-dry '}).description).toBe(
      'Wash, cut and blow-dry',
    );
    expect(toServiceRow({}).description).toBe('');
  });

  it('names an untitled service rather than rendering a blank row', () => {
    expect(toServiceRow({name: '   '}).name).toBe('Untitled service');
    expect(toServiceRow({}).name).toBe('Untitled service');
  });

  it('coerces string prices', () => {
    // BigDecimal can serialise as a string depending on the mapper.
    expect(toServiceRow({price: '1500.00'}).price).toBe(1500);
  });
});

describe('availability', () => {
  it('reads straight off the stored flag', () => {
    expect(availabilityStateFor(row({availability: true}))).toBe('AVAILABLE');
    expect(availabilityStateFor(row({availability: false}))).toBe('UNAVAILABLE');
  });

  it('labels and tints both states', () => {
    expect(AVAILABILITY_LABEL.AVAILABLE).toBe('Available');
    expect(AVAILABILITY_LABEL.UNAVAILABLE).toBe('Unavailable');
    expect(AVAILABILITY_TINT.AVAILABLE).toBe('success');
    expect(AVAILABILITY_TINT.UNAVAILABLE).toBe('error');
  });
});

describe('formatDuration', () => {
  it('renders bare minutes, matching the mockups', () => {
    expect(formatDuration(20)).toBe('20 min');
    expect(formatDuration(90)).toBe('90 min');
    // Deliberately not "3h" — the mockup writes 180 min and so does the rest of the app.
    expect(formatDuration(180)).toBe('180 min');
  });

  it('says nothing when there is no duration to say', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(-5)).toBe('');
  });
});

describe('formatting', () => {
  it('groups prices the Indian way', () => {
    expect(formatPrice(250)).toBe('₹250');
    expect(formatPrice(15000)).toBe('₹15,000');
    expect(formatPrice(1234567)).toBe('₹12,34,567');
  });

  it('pluralises the panel line', () => {
    expect(servicesHeaderLine(30)).toBe('30 services');
    expect(servicesHeaderLine(1)).toBe('1 service');
    expect(servicesHeaderLine(0)).toBe('0 services');
  });

  it('pluralises the search result line', () => {
    expect(servicesResultLine(3, 'Facial')).toBe("3 results for 'Facial'");
    expect(servicesResultLine(1, 'Spa')).toBe("1 result for 'Spa'");
    expect(servicesResultLine(0, 'Botox')).toBe("0 results for 'Botox'");
  });
});

describe('serviceTintIndex', () => {
  // The thumbnail has to survive a re-render and a refetch, or the list shimmers.
  it('is stable for the same name', () => {
    expect(serviceTintIndex('Gold Facial Treatment', 8)).toBe(
      serviceTintIndex('Gold Facial Treatment', 8),
    );
  });

  it('stays inside the pool', () => {
    for (const name of ['a', 'Threading - Face', 'Manicure & Pedicure', '']) {
      const i = serviceTintIndex(name, 8);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(8);
    }
  });

  it('does not divide by zero on an empty pool', () => {
    expect(serviceTintIndex('anything', 0)).toBe(0);
  });
});
