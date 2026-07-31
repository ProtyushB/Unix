/**
 * The show/hide decision for the auto-hiding list header, extracted so it can be unit tested.
 *
 * The mockups (Orders `Scroll Up`/`Scroll Down`, Appointments likewise) specify a header that
 * leaves on a downward scroll and comes back on an upward one — not a header that merely scrolls
 * off with the content. That is a state machine driven by a stream of scroll offsets, and the
 * interesting parts of it are all edge cases: bounce, short lists, jitter, refresh. Keeping it pure
 * and RN-free means the repo's plain-node jest covers every branch without a rendering harness,
 * the same reason `appointment.view.ts` exists.
 *
 * Marked `'worklet'` so the Reanimated scroll handler can call it directly on the UI thread. The
 * worklets babel plugin only bolts `__workletHash` onto the function object, so it stays an
 * ordinary callable under jest — verified, not assumed.
 */

export interface HeaderScrollSample {
  /** `event.contentOffset.y`. Negative while overscrolling at the top. */
  offsetY: number;
  /** `event.layoutMeasurement.height` — the visible scroll viewport. */
  viewportHeight: number;
  /** `event.contentSize.height` — grows as pages are appended. */
  contentHeight: number;
  /** Measured header height. 0 until the first `onLayout`. */
  headerHeight: number;
  /** Never hide while true: search mode, and every hero/empty/error/loading view. */
  pinned: boolean;
  /** Pull-to-refresh in flight. */
  refreshing: boolean;
}

export interface HeaderScrollState {
  shown: boolean;
  /**
   * The most extreme offset reached since the last flip, in whichever direction is already
   * satisfied. Counter-motion is measured against this, which is what gives us direction
   * detection without storing a previous offset or a running delta.
   */
  anchorY: number;
}

export interface HeaderScrollConfig {
  /** Counter-motion required before the header flips, in px. Kills 1px jitter. */
  reversalThreshold: number;
  /** At or below this offset the header is always shown. */
  topClamp: number;
  /** Scrollable slack required beyond the header's own height before hiding is allowed. */
  minScrollableSlack: number;
}

export const DEFAULT_HEADER_CONFIG: HeaderScrollConfig = {
  reversalThreshold: 12,
  topClamp: 4,
  minScrollableSlack: 24,
};

export const INITIAL_HEADER_STATE: HeaderScrollState = { shown: true, anchorY: 0 };

/**
 * Fold one scroll sample into the header state.
 *
 * The rule order below IS the specification — several of the guards overlap, and an earlier one
 * winning is deliberate in every case.
 */
export function nextHeaderState(
  prev: HeaderScrollState,
  s: HeaderScrollSample,
  cfg: HeaderScrollConfig = DEFAULT_HEADER_CONFIG,
): HeaderScrollState {
  'worklet';

  // 1. Pinned beats everything. The anchor is reset so that leaving a pinned view doesn't
  //    immediately flip on a stale delta accumulated before the pin.
  if (s.pinned) return { shown: true, anchorY: s.offsetY };

  // 2. Same for refresh: the flick that follows a pull-to-refresh should start from scratch.
  if (s.refreshing) return { shown: true, anchorY: s.offsetY };

  // 3. Unmeasured header. Hiding by 0px is invisible but would latch `shown: false`, so the
  //    header would be gone the instant measurement landed.
  if (s.headerHeight <= 0) return { shown: true, anchorY: s.offsetY };

  // 4. At (or above) the top. Also catches negative offsets from iOS bounce and Safari's elastic
  //    scroll — no separate clause needed for those.
  if (s.offsetY <= cfg.topClamp) return { shown: true, anchorY: s.offsetY };

  // 5. Short content. If the scrollable range is barely longer than the header itself, hiding it
  //    flutters and there may be no room left to scroll back up and get it again.
  const scrollable = s.contentHeight - s.viewportHeight;
  if (scrollable <= s.headerHeight + cfg.minScrollableSlack) {
    return { shown: true, anchorY: s.offsetY };
  }

  // 6. Overscrolled past the end. The rubber band snapping back reads as upward motion and would
  //    pop the header in while the user sits at the bottom of the list. Freeze instead.
  if (s.offsetY > scrollable) return prev;

  // 7. Direction, with hysteresis. The anchor tracks the extremum of the already-satisfied
  //    direction, so only genuine counter-motion accumulates against it.
  if (prev.shown) {
    const anchorY = prev.anchorY < s.offsetY ? prev.anchorY : s.offsetY;
    if (s.offsetY - anchorY > cfg.reversalThreshold) {
      return { shown: false, anchorY: s.offsetY };
    }
    return { shown: true, anchorY };
  }

  const anchorY = prev.anchorY > s.offsetY ? prev.anchorY : s.offsetY;
  if (anchorY - s.offsetY > cfg.reversalThreshold) {
    return { shown: true, anchorY: s.offsetY };
  }
  return { shown: false, anchorY };
}
