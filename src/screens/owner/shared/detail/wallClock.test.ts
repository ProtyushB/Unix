import {
  IST_OFFSET_MINUTES,
  TIME_SLOTS,
  nowIstParts,
  joinIstInstant,
  joinWallClock,
  splitIstInstant,
  splitWallClock,
} from './wallClock';

// The slot list, formatClock, splitWallClock, joinWallClock and snapToSlot are covered in full by
// `consumptionDetail.model.test.ts`, which pinned them before they moved here and still does
// through the re-exports. This file covers what is NEW: the instant pair, and the fact that the two
// join functions are not interchangeable.

describe('the two wire formats are different, and mixing them is a 500', () => {
  it('joinWallClock emits NO zone — consumedAt / appointmentDateTime are LocalDateTime', () => {
    expect(joinWallClock('2026-08-09', '14:30')).toBe('2026-08-09T14:30:00');
    expect(joinWallClock('2026-08-09', '14:30')).not.toMatch(/[Z+]/);
  });

  it('joinIstInstant emits an OFFSET — expenseDate is an Instant and cannot bind without one', () => {
    expect(joinIstInstant('2026-08-09', '14:30')).toBe('2026-08-09T14:30:00+05:30');
  });

  it('both answer empty for an empty date, so the caller can send null', () => {
    expect(joinWallClock('', '14:30')).toBe('');
    expect(joinIstInstant('', '14:30')).toBe('');
    expect(joinIstInstant('   ', '14:30')).toBe('');
  });

  it('both fall back to midnight when only a date was picked', () => {
    // The user chose a day; discarding it silently because they did not also open the clock would
    // be worse than assuming the start of that day.
    expect(joinWallClock('2026-08-09', '')).toBe('2026-08-09T00:00:00');
    expect(joinIstInstant('2026-08-09', '')).toBe('2026-08-09T00:00:00+05:30');
  });
});

describe('splitIstInstant', () => {
  it('reads a UTC instant back as the IST wall clock the user typed', () => {
    // 09:00Z is 14:30 IST — the exact round trip of the joinIstInstant example above.
    expect(splitIstInstant('2026-08-09T09:00:00Z')).toEqual({ date: '2026-08-09', time: '14:30' });
  });

  it('round-trips with joinIstInstant', () => {
    const joined = joinIstInstant('2026-08-09', '14:30');
    expect(splitIstInstant(joined)).toEqual({ date: '2026-08-09', time: '14:30' });
  });

  it('rolls the DATE forward when the instant is late enough in UTC', () => {
    // 20:00Z on the 9th is 01:30 IST on the 10th. Slicing the ISO string would report the 9th — the
    // off-by-one this module exists to prevent, in the opposite direction to the usual one.
    expect(splitIstInstant('2026-08-09T20:00:00Z')).toEqual({ date: '2026-08-10', time: '01:30' });
  });

  it('rolls the DATE backward before 05:30 IST', () => {
    // 23:00Z on the 8th is 04:30 IST on the 9th — same day boundary the billing model warns about.
    expect(splitIstInstant('2026-08-08T23:00:00Z')).toEqual({ date: '2026-08-09', time: '04:30' });
    expect(splitIstInstant('2026-08-09T00:00:00Z')).toEqual({ date: '2026-08-09', time: '05:30' });
  });

  it('accepts an instant that already carries the IST offset', () => {
    expect(splitIstInstant('2026-08-09T14:30:00+05:30')).toEqual({
      date: '2026-08-09',
      time: '14:30',
    });
  });

  it('answers empty rather than throwing on junk, so one bad stamp cannot blank a screen', () => {
    expect(splitIstInstant(null)).toEqual({ date: '', time: '' });
    expect(splitIstInstant('')).toEqual({ date: '', time: '' });
    expect(splitIstInstant('not a date')).toEqual({ date: '', time: '' });
  });

  it('pads every part to two digits', () => {
    expect(splitIstInstant('2026-01-02T01:04:00Z')).toEqual({ date: '2026-01-02', time: '06:34' });
  });
});

describe('nowIstParts', () => {
  it('gives the IST date and a time snapped BACK to a slot', () => {
    // 11:37Z is 17:07 IST, which is not a slot — snapping forward would seed a time that has not
    // happened yet, so it floors to 17:00.
    expect(nowIstParts(new Date('2026-08-04T11:37:00.000Z'))).toEqual({
      date: '2026-08-04',
      time: '17:00',
    });
  });

  it('leaves an exact slot alone', () => {
    expect(nowIstParts(new Date('2026-08-04T11:45:00.000Z'))).toEqual({
      date: '2026-08-04',
      time: '17:15',
    });
  });

  it('uses the IST day, which can be tomorrow', () => {
    expect(nowIstParts(new Date('2026-08-09T20:10:00.000Z'))).toEqual({
      date: '2026-08-10',
      time: '01:30',
    });
  });
});

describe('the offset itself', () => {
  it('is 330 minutes and fixed — India has never observed DST', () => {
    // A DST-aware zone would make the arithmetic in splitIstInstant wrong half the year; this
    // asserts the assumption the module is built on rather than leaving it in a comment.
    expect(IST_OFFSET_MINUTES).toBe(330);
    // Same wall clock in January and in July resolves to the same offset.
    expect(joinIstInstant('2026-01-15', '12:00')).toBe('2026-01-15T12:00:00+05:30');
    expect(joinIstInstant('2026-07-15', '12:00')).toBe('2026-07-15T12:00:00+05:30');
  });
});

describe('splitWallClock vs splitIstInstant', () => {
  it('splitWallClock does NOT convert — it is string surgery on a zone-less value', () => {
    // Feeding it an instant would silently keep the UTC clock, which is the bug the two names
    // exist to keep apart.
    expect(splitWallClock('2026-08-09T14:30:00')).toEqual({ date: '2026-08-09', time: '14:30' });
  });

  it('the slot list covers the whole day at quarter-hour steps', () => {
    expect(TIME_SLOTS).toHaveLength(96);
    expect(TIME_SLOTS[0]).toBe('00:00');
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toBe('23:45');
  });
});
