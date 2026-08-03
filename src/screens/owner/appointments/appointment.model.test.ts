import {
  formatApptTime,
  apptClock,
  apptMeridiem,
  toAppointmentRow,
  serviceSummary,
} from './appointment.model';

describe('formatApptTime', () => {
  // Midnight and noon are where a naive `h % 12` produces "0:05 AM" and "0:00 PM".
  it('handles the 12-hour boundaries', () => {
    expect(formatApptTime('00:05')).toBe('12:05 AM');
    expect(formatApptTime('12:00')).toBe('12:00 PM');
  });

  it('formats morning and afternoon', () => {
    expect(formatApptTime('09:30')).toBe('9:30 AM');
    expect(formatApptTime('13:05')).toBe('1:05 PM');
    expect(formatApptTime('23:45')).toBe('11:45 PM');
  });

  it('returns empty for missing or unparseable input rather than "NaN:xx"', () => {
    expect(formatApptTime(undefined)).toBe('');
    expect(formatApptTime(null)).toBe('');
    expect(formatApptTime('')).toBe('');
    expect(formatApptTime('not-a-time')).toBe('');
  });

  it('splits into clock and meridiem for the stacked gutter', () => {
    expect(apptClock('13:05')).toBe('1:05');
    expect(apptMeridiem('13:05')).toBe('PM');
    expect(apptClock('00:05')).toBe('12:05');
    expect(apptMeridiem('00:05')).toBe('AM');
  });
});

describe('toAppointmentRow', () => {
  const raw = {
    id: 12,
    appointmentNumber: 'APT-23042025-001',
    customerFirstName: 'Priya',
    customerLastName: 'Sharma',
    appointmentDate: '2025-04-23',
    appointmentTime: '10:00',
    appointmentDateTime: '2025-04-23T10:00:00',
    totalAmount: 400,
    appointmentStatus: 'CONFIRMED',
    customerPhoneNumber: '9999999999',
    customerEmail: 'p@example.com',
    isBilled: false,
    appointmentItemsWithDetails: [{ serviceName: 'Haircut' }],
  };

  it('maps the happy path', () => {
    const row = toAppointmentRow(raw);
    expect(row).toMatchObject({
      id: 12,
      appointmentNumber: 'APT-23042025-001',
      customerName: 'Priya Sharma',
      date: '2025-04-23',
      time: '10:00',
      amount: 400,
      status: 'CONFIRMED',
      serviceName: 'Haircut',
      itemCount: 1,
      isBilled: false,
    });
  });

  // The whole IST contract: date and time come from the server's pre-split fields, never from
  // parsing the zone-less appointmentDateTime in the device's timezone.
  it('takes date and time from the server fields, not appointmentDateTime', () => {
    const row = toAppointmentRow({ ...raw, appointmentDateTime: '1999-01-01T23:59:59' });
    expect(row.date).toBe('2025-04-23');
    expect(row.time).toBe('10:00');
  });

  it('defaults a missing status to CONFIRMED, the server-side default', () => {
    const { appointmentStatus, ...noStatus } = raw;
    expect(toAppointmentRow(noStatus).status).toBe('CONFIRMED');
  });

  it('falls back when the customer name is absent', () => {
    const { customerFirstName, customerLastName, ...anon } = raw;
    expect(toAppointmentRow(anon).customerName).toBe('Unknown customer');
  });

  it('uses only the first name when there is no last name', () => {
    const { customerLastName, ...partial } = raw;
    expect(toAppointmentRow(partial).customerName).toBe('Priya');
  });

  it('falls back to appointmentItems and then to a generic service label', () => {
    const { appointmentItemsWithDetails, ...noDetails } = raw;
    expect(
      toAppointmentRow({ ...noDetails, appointmentItems: [{ packageName: 'Bridal' }] }).serviceName,
    ).toBe('Bridal');
    expect(toAppointmentRow(noDetails).serviceName).toBe('Service');
    expect(toAppointmentRow(noDetails).itemCount).toBe(0);
  });

  it('coerces a non-numeric amount to zero rather than NaN', () => {
    expect(toAppointmentRow({ ...raw, totalAmount: undefined }).amount).toBe(0);
    expect(toAppointmentRow({ ...raw, totalAmount: 'oops' }).amount).toBe(0);
  });
});

describe('serviceSummary', () => {
  const row = toAppointmentRow({
    id: 1,
    appointmentItemsWithDetails: [
      { serviceName: 'Haircut' },
      { serviceName: 'Shave' },
      { serviceName: 'Facial' },
    ],
  });

  it('appends a count when there is more than one item', () => {
    expect(serviceSummary(row)).toBe('Haircut +2');
  });

  it('shows the bare name for a single item', () => {
    const single = toAppointmentRow({
      id: 2,
      appointmentItemsWithDetails: [{ serviceName: 'Haircut' }],
    });
    expect(serviceSummary(single)).toBe('Haircut');
  });
});
