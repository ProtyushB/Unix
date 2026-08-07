import {
  STAGE_ASPECT_RATIO,
  THUMB_GAP,
  THUMB_SIZE,
  clampIndex,
  counterLabel,
  offsetForPage,
  pageIndexFromOffset,
  showsPager,
  thumbStripOffset,
} from './imageStage';

describe('STAGE_ASPECT_RATIO', () => {
  it('is 3:4 PORTRAIT, in the width÷height direction RN expects', () => {
    // 0.75, not 1.333. Getting this inverted draws a landscape box that still "looks deliberate",
    // which is exactly the kind of bug that ships.
    expect(STAGE_ASPECT_RATIO).toBeCloseTo(0.75);
    expect(STAGE_ASPECT_RATIO).toBeLessThan(1);
  });

  it('draws the mockup at the width the screen actually gives it', () => {
    // 390pt phone less the content's 16pt gutters = 358, and the mockup's stage is 358 × 477.
    expect(Math.round(358 / STAGE_ASPECT_RATIO)).toBe(477);
  });
});

describe('showsPager', () => {
  it('needs something to page between', () => {
    expect(showsPager(0)).toBe(false);
    // "1 / 1" beside a single dot is furniture that says nothing.
    expect(showsPager(1)).toBe(false);
    expect(showsPager(2)).toBe(true);
  });
});

describe('counterLabel', () => {
  it('reads one-based, as the mockup draws it', () => {
    expect(counterLabel(0, 4)).toBe('1 / 4');
    expect(counterLabel(3, 4)).toBe('4 / 4');
  });

  it('cannot read past the end even if handed a stale index', () => {
    // "5 / 4" is worse than a repeated 4 — it says the list is one longer than it is.
    expect(counterLabel(9, 4)).toBe('4 / 4');
  });
});

describe('clampIndex', () => {
  it('holds the index inside the list', () => {
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(-1, 4)).toBe(0);
  });

  it('floors an empty list at 0, not -1', () => {
    // count - 1 would be -1, and every caller downstream indexes an array with this.
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(3, 0)).toBe(0);
  });

  it('survives the last photo being removed while it is on screen', () => {
    expect(clampIndex(3, 3)).toBe(2);
  });
});

describe('pageIndexFromOffset', () => {
  const W = 358;

  it('reads a settled page', () => {
    expect(pageIndexFromOffset(0, W, 4)).toBe(0);
    expect(pageIndexFromOffset(W, W, 4)).toBe(1);
    expect(pageIndexFromOffset(W * 3, W, 4)).toBe(3);
  });

  it('rounds rather than floors, so a hair under a page boundary still counts as arrived', () => {
    // The real number RN reports for page 2 of a 358-wide stage. Flooring reads this as page 1 and
    // leaves the dot one behind the photo.
    expect(pageIndexFromOffset(717.9997, W, 4)).toBe(2);
    expect(pageIndexFromOffset(W - 0.5, W, 4)).toBe(1);
  });

  it('does not divide by a first-frame width of zero', () => {
    // NaN here would poison the counter and every dot comparison downstream.
    expect(pageIndexFromOffset(120, 0, 4)).toBe(0);
    expect(pageIndexFromOffset(120, -1, 4)).toBe(0);
  });

  it('cannot report a page past the end after an over-scroll bounce', () => {
    expect(pageIndexFromOffset(W * 9, W, 4)).toBe(3);
    expect(pageIndexFromOffset(-40, W, 4)).toBe(0);
  });
});

describe('offsetForPage', () => {
  it('inverts pageIndexFromOffset exactly', () => {
    const W = 358;
    for (const i of [0, 1, 2, 3]) {
      expect(pageIndexFromOffset(offsetForPage(i, W), W, 4)).toBe(i);
    }
  });

  it('never scrolls to a negative offset', () => {
    expect(offsetForPage(-2, 358)).toBe(0);
    expect(offsetForPage(2, -358)).toBe(0);
  });
});

describe('thumbStripOffset', () => {
  it('steps one thumb plus one gap per photo', () => {
    expect(thumbStripOffset(0)).toBe(0);
    expect(thumbStripOffset(1)).toBe(THUMB_SIZE + THUMB_GAP);
    expect(thumbStripOffset(3)).toBe(3 * (THUMB_SIZE + THUMB_GAP));
  });

  it('left-aligns rather than centring, so earlier photos stay in view', () => {
    // Centring would put the active thumb mid-strip and push everything before it off the left.
    expect(thumbStripOffset(2)).toBe(136);
  });

  it('never scrolls to a negative offset', () => {
    expect(thumbStripOffset(-1)).toBe(0);
  });
});
