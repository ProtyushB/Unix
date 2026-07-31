import {
  nextHeaderState,
  INITIAL_HEADER_STATE,
  DEFAULT_HEADER_CONFIG,
  type HeaderScrollSample,
  type HeaderScrollState,
} from './collapsingHeader';

/** A long, comfortably scrollable list with a measured header and nothing special going on. */
const base: HeaderScrollSample = {
  offsetY: 200,
  viewportHeight: 800,
  contentHeight: 4000,
  headerHeight: 180,
  pinned: false,
  refreshing: false,
};

const at = (offsetY: number, over: Partial<HeaderScrollSample> = {}): HeaderScrollSample => ({
  ...base,
  offsetY,
  ...over,
});

const SHOWN: HeaderScrollState = { shown: true, anchorY: 200 };
const HIDDEN: HeaderScrollState = { shown: false, anchorY: 200 };

/** Feed a sequence of offsets through the fold, starting from `from`. */
const scroll = (from: HeaderScrollState, offsets: number[], over: Partial<HeaderScrollSample> = {}) =>
  offsets.reduce((st, y) => nextHeaderState(st, at(y, over)), from);

describe('precedence', () => {
  // Pinned is how search mode and every hero state opt out. A 400px drag must not move it.
  it('keeps the header shown while pinned, however far you scroll', () => {
    expect(nextHeaderState(SHOWN, at(600, { pinned: true })).shown).toBe(true);
    expect(nextHeaderState(HIDDEN, at(600, { pinned: true })).shown).toBe(true);
  });

  it('resets the anchor when pinned so unpinning does not flip on a stale delta', () => {
    expect(nextHeaderState(SHOWN, at(600, { pinned: true })).anchorY).toBe(600);
  });

  it('keeps the header shown while refreshing', () => {
    expect(nextHeaderState(HIDDEN, at(600, { refreshing: true }))).toEqual({
      shown: true,
      anchorY: 600,
    });
  });

  // Negative offset + refreshing is the ordinary pull-to-refresh gesture.
  it('handles refreshing at a negative offset', () => {
    expect(nextHeaderState(HIDDEN, at(-80, { refreshing: true })).shown).toBe(true);
  });

  // Hiding by 0px is invisible, but it would latch shown:false and the header would vanish the
  // moment onLayout reported a real height.
  it('stays shown while the header is unmeasured', () => {
    expect(nextHeaderState(SHOWN, at(600, { headerHeight: 0 })).shown).toBe(true);
    expect(nextHeaderState(HIDDEN, at(600, { headerHeight: 0 })).shown).toBe(true);
  });
});

describe('top of the list', () => {
  it('is shown at exactly zero, even mid-fling', () => {
    expect(nextHeaderState(HIDDEN, at(0)).shown).toBe(true);
  });

  // iOS bounce and Safari elastic scroll both produce negative offsets.
  it('is shown while overscrolled above the top', () => {
    expect(nextHeaderState(HIDDEN, at(-120)).shown).toBe(true);
  });

  // Both cases sit at the anchor, so the direction rule contributes nothing and the clamp is the
  // only thing that can decide. That is what isolates the boundary.
  it('is shown at the top clamp boundary but not past it', () => {
    const clamp = DEFAULT_HEADER_CONFIG.topClamp;
    expect(nextHeaderState({ shown: false, anchorY: clamp }, at(clamp)).shown).toBe(true);
    expect(nextHeaderState({ shown: false, anchorY: clamp + 1 }, at(clamp + 1)).shown).toBe(false);
  });
});

describe('short content', () => {
  // Nothing to scroll at all.
  it('never hides when content exactly fills the viewport', () => {
    expect(nextHeaderState(SHOWN, at(600, { contentHeight: 800 })).shown).toBe(true);
  });

  // If the scrollable range is no longer than the header, hiding flutters and there may be no
  // room left to scroll back up and recover it.
  //
  // The offsets below stay inside the scrollable range (~205px in these cases) on purpose — push
  // past it and rule 6 freezes the state before rule 5 is ever consulted, so the test would pass
  // without proving anything.
  const shortRun = [60, 120, 180];

  it('never hides when the scrollable range is shorter than the header plus slack', () => {
    const contentHeight = 800 + 180 + DEFAULT_HEADER_CONFIG.minScrollableSlack - 1;
    expect(scroll(SHOWN, shortRun, { contentHeight }).shown).toBe(true);
  });

  it('treats the boundary as too short', () => {
    const contentHeight = 800 + 180 + DEFAULT_HEADER_CONFIG.minScrollableSlack;
    expect(scroll(SHOWN, shortRun, { contentHeight }).shown).toBe(true);
  });

  it('allows hiding one px beyond the boundary', () => {
    const contentHeight = 800 + 180 + DEFAULT_HEADER_CONFIG.minScrollableSlack + 1;
    expect(scroll(SHOWN, shortRun, { contentHeight }).shown).toBe(false);
  });
});

describe('bottom overscroll', () => {
  // The rubber band snapping back reads as upward motion; without this the header pops in every
  // time you hit the end of the list.
  it('freezes state past the end of the content', () => {
    const past = at(base.contentHeight - base.viewportHeight + 50);
    expect(nextHeaderState(HIDDEN, past)).toBe(HIDDEN);
    expect(nextHeaderState(SHOWN, past)).toBe(SHOWN);
  });
});

describe('direction and hysteresis', () => {
  it('hides after scrolling down past the threshold', () => {
    expect(scroll(SHOWN, [220]).shown).toBe(false);
  });

  it('ignores jitter smaller than the threshold', () => {
    expect(scroll(SHOWN, [201, 200, 201, 199, 200]).shown).toBe(true);
  });

  // The threshold is cumulative against the anchor, not per-event.
  it('accumulates small downward moves until the threshold is crossed', () => {
    expect(scroll(SHOWN, [211]).shown).toBe(true);
    expect(scroll(SHOWN, [211, 213]).shown).toBe(false);
  });

  it('brings the header back on an upward scroll without reaching the top', () => {
    const hidden = scroll(SHOWN, [400]);
    expect(hidden.shown).toBe(false);
    expect(scroll(hidden, [384]).shown).toBe(true);
  });

  // The anchor is an extremum, so a small bounce inside a longer gesture nets out.
  it('stays hidden when a small reversal is undone', () => {
    const hidden = scroll(SHOWN, [400]);
    expect(scroll(hidden, [395, 400]).shown).toBe(false);
  });

  it('measures upward motion from the deepest point reached, not the flip point', () => {
    // Down to 400 (hides), further down to 500, then up 15 from there — enough to flip back.
    const st = scroll(SHOWN, [400, 500, 485]);
    expect(st.shown).toBe(true);
  });
});

describe('pagination', () => {
  // contentHeight jumps when a page lands. Only offsetY drives the decision, so this is a no-op.
  it('does not flip when content grows underneath a stationary scroll position', () => {
    const st = scroll(SHOWN, [400]);
    expect(st.shown).toBe(false);
    expect(nextHeaderState(st, at(400, { contentHeight: 8000 })).shown).toBe(false);
  });
});

describe('INITIAL_HEADER_STATE', () => {
  it('starts shown at the top', () => {
    expect(INITIAL_HEADER_STATE).toEqual({ shown: true, anchorY: 0 });
  });
});
