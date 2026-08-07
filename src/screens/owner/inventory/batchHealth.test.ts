import {
  daysToExpiry,
  expiryCountdownLabel,
  expiryState,
  remainingPercent,
  remainingRatio,
  remainingState,
} from './batchHealth';

const TODAY = '2026-08-07';

describe('remainingState', () => {
  it('uses CENTRIX thresholds — 20 and 5, not the mockup legend s 50 and 15', () => {
    // The same batch must not read healthy on the web portal and critical on the phone.
    expect(remainingState(100, 21)).toBe('healthy');
    expect(remainingState(100, 20)).toBe('low');
    expect(remainingState(100, 6)).toBe('low');
    expect(remainingState(100, 5)).toBe('critical');
    expect(remainingState(100, 1)).toBe('critical');
  });

  it('reads a depleted batch as "none", not "critical"', () => {
    // Deliberate parity with Centrix: DEPLETED already says so in the status pill, and red is kept
    // for stock you could still act on.
    expect(remainingState(100, 0)).toBe('none');
  });

  it('has no opinion when there is no denominator', () => {
    expect(remainingState(0, 0)).toBe('none');
    expect(remainingState(null, 5)).toBe('none');
    expect(remainingState(undefined, undefined)).toBe('none');
  });

  it('is exclusive at 20 and inclusive at 5, which is where the bands actually flip', () => {
    expect(remainingState(1000, 201)).toBe('healthy');
    expect(remainingState(1000, 200)).toBe('low');
    expect(remainingState(1000, 51)).toBe('low');
    expect(remainingState(1000, 50)).toBe('critical');
  });
});

describe('remainingPercent', () => {
  it('is a percentage, not a ratio', () => {
    expect(remainingPercent(50, 12)).toBe(24);
  });

  it('returns null rather than dividing by zero', () => {
    expect(remainingPercent(0, 10)).toBeNull();
    expect(remainingPercent(null, 10)).toBeNull();
  });
});

describe('remainingRatio', () => {
  it('is 0-1 for a progress track', () => {
    expect(remainingRatio(50, 12)).toBeCloseTo(0.24);
    expect(remainingRatio(50, 50)).toBe(1);
    expect(remainingRatio(50, 0)).toBe(0);
  });

  it('clamps, so bad data cannot paint a bar past its track', () => {
    // Remaining > purchased should not happen, but a restock bug would draw a 140%-wide fill.
    expect(remainingRatio(50, 70)).toBe(1);
    expect(remainingRatio(50, -10)).toBe(0);
  });
});

describe('expiryState', () => {
  it('treats the printed date itself as EXPIRED, not the day after', () => {
    // The conservative boundary the backend enforces — a batch expiring today is already dead.
    expect(expiryState(TODAY, TODAY)).toBe('expired');
    expect(expiryState('2026-08-06', TODAY)).toBe('expired');
  });

  it('warns for 30 days, and is inclusive at exactly 30', () => {
    expect(expiryState('2026-08-08', TODAY)).toBe('near');
    expect(expiryState('2026-09-06', TODAY)).toBe('near'); // exactly 30 days
    expect(expiryState('2026-09-07', TODAY)).toBe('fresh'); // 31
  });

  it('uses 30 days, NOT the mockup legend s 90', () => {
    // A batch 60 days out is fresh on both clients.
    expect(expiryState('2026-10-06', TODAY)).toBe('fresh');
  });

  it('has no state for a batch with no expiry date', () => {
    expect(expiryState(null, TODAY)).toBe('none');
    expect(expiryState(undefined, TODAY)).toBe('none');
    expect(expiryState('', TODAY)).toBe('none');
  });

  it('tolerates a full ISO timestamp by taking the date part', () => {
    // The server sends a bare date, but a caller handing over an instant should not silently
    // fall into the wrong band.
    expect(expiryState('2026-08-06T18:30:00Z', TODAY)).toBe('expired');
  });
});

describe('daysToExpiry', () => {
  it('counts whole days forward', () => {
    expect(daysToExpiry('2026-09-06', TODAY)).toBe(30);
    expect(daysToExpiry('2026-08-08', TODAY)).toBe(1);
  });

  it('goes negative once past', () => {
    expect(daysToExpiry('2026-08-01', TODAY)).toBe(-6);
  });

  it('crosses a month boundary without drifting', () => {
    expect(daysToExpiry('2026-09-01', '2026-08-31')).toBe(1);
    // And a leap year, where a naive +30 on the month number breaks.
    expect(daysToExpiry('2028-03-01', '2028-02-28')).toBe(2);
  });
});

describe('expiryCountdownLabel', () => {
  it('appears only inside the near-expiry window', () => {
    expect(expiryCountdownLabel('2026-08-27', TODAY)).toBe('20d left');
    // Fresh: the countdown would be noise.
    expect(expiryCountdownLabel('2026-12-01', TODAY)).toBeNull();
    // Expired: it would read "-6d left".
    expect(expiryCountdownLabel('2026-08-01', TODAY)).toBeNull();
    expect(expiryCountdownLabel(null, TODAY)).toBeNull();
  });

  it('does not say "1d s" left', () => {
    expect(expiryCountdownLabel('2026-08-08', TODAY)).toBe('1d left');
  });
});
