import {
  destinationNote,
  partitionProductsByDestination,
  partitionServicesByDestination,
  productNeedsOrder,
  serviceNeedsAppointment,
} from './quickAddRouting';

describe('productNeedsOrder', () => {
  it('reads the flag', () => {
    expect(productNeedsOrder({ isOrderRequired: true })).toBe(true);
    expect(productNeedsOrder({ isOrderRequired: false })).toBe(false);
  });

  it('defaults to needing an order when the flag is absent', () => {
    // NOT NULL DEFAULT true since V111. Bare is the behaviour change, so an older backend or a
    // stale cached row must never read as bare.
    expect(productNeedsOrder({})).toBe(true);
    expect(productNeedsOrder(null)).toBe(true);
    expect(productNeedsOrder(undefined)).toBe(true);
  });

  it('forces an order for a COMBO even when the flag says otherwise', () => {
    // A combo's deduction expands to its sub-products inside the order funnel — a flat bare line
    // cannot reproduce that, and the server enforces the same rail.
    expect(productNeedsOrder({ productType: 'COMBO', isOrderRequired: false })).toBe(true);
  });

  it('does not treat a null flag as false', () => {
    // `!== false` is deliberate rather than truthiness: a null flag is "not told", not "no".
    expect(productNeedsOrder({ isOrderRequired: null })).toBe(true);
  });
});

describe('serviceNeedsAppointment', () => {
  it('reads the flag, defaulting to true', () => {
    expect(serviceNeedsAppointment({ isAppointmentRequired: false })).toBe(false);
    expect(serviceNeedsAppointment({ isAppointmentRequired: true })).toBe(true);
    expect(serviceNeedsAppointment({})).toBe(true);
  });

  it('has no COMBO equivalent — a service is only ever its own flag', () => {
    expect(serviceNeedsAppointment({ isAppointmentRequired: false })).toBe(false);
  });
});

describe('partitioning', () => {
  it('splits products into the two destinations', () => {
    const { orderBound, bare } = partitionProductsByDestination([
      { id: 1, isOrderRequired: true },
      { id: 2, isOrderRequired: false },
      { id: 3, productType: 'COMBO', isOrderRequired: false },
      { id: 4 },
    ] as { id: number; isOrderRequired?: boolean; productType?: string }[]);
    expect(orderBound.map((p) => p.id)).toEqual([1, 3, 4]);
    expect(bare.map((p) => p.id)).toEqual([2]);
  });

  it('splits services the same way', () => {
    const { appointmentBound, bare } = partitionServicesByDestination([
      { id: 1, isAppointmentRequired: false },
      { id: 2 },
    ] as { id: number; isAppointmentRequired?: boolean }[]);
    expect(appointmentBound.map((s) => s.id)).toEqual([2]);
    expect(bare.map((s) => s.id)).toEqual([1]);
  });

  it('survives a missing list', () => {
    expect(partitionProductsByDestination(null)).toEqual({ orderBound: [], bare: [] });
    expect(partitionServicesByDestination(undefined)).toEqual({ appointmentBound: [], bare: [] });
  });
});

describe('destinationNote', () => {
  it('names the record that will appear', () => {
    expect(destinationNote(true, 'PRODUCT')).toBe('Will create an order');
    expect(destinationNote(true, 'SERVICE')).toBe('Will create an appointment');
    expect(destinationNote(false, 'PRODUCT')).toBe('Billed directly');
  });
});
