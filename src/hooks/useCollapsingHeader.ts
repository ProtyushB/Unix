import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  nextHeaderState,
  INITIAL_HEADER_STATE,
  DEFAULT_HEADER_CONFIG,
  type HeaderScrollConfig,
} from './collapsingHeader';

interface Options {
  /** Never hide while true: search mode, and every hero / empty / error / loading view. */
  pinned: boolean;
  /** Mirrors the screen's pull-to-refresh state. */
  refreshing: boolean;
  /** Bottom padding — FAB clearance. */
  contentBottomPadding: number;
  config?: Partial<HeaderScrollConfig>;
}

/**
 * Drives the auto-hiding header: measures it, folds scroll events through the pure rule in
 * {@link nextHeaderState}, and hands back the props for the header and the list.
 *
 * Knows nothing about what the header *contains* — only how tall it measured. That is what lets
 * one hook serve Orders (title + search + two chip ScrollViews) and Appointments (title + search +
 * a six-row month grid) without branching.
 */
export function useCollapsingHeader({
  pinned,
  refreshing,
  contentBottomPadding,
  config,
}: Options) {
  const cfg = useMemo(() => ({ ...DEFAULT_HEADER_CONFIG, ...config }), [config]);

  // Height lives in two places on purpose: the worklet cannot read React state, and the layout
  // cannot read a shared value.
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerH = useSharedValue(0);

  // Mirrored so the worklet sees the current values without the handler being rebuilt.
  const pinnedSV = useSharedValue(pinned);
  const refreshingSV = useSharedValue(refreshing);

  const state = useSharedValue(INITIAL_HEADER_STATE);
  const translateY = useSharedValue(0);

  // Written in an effect, never during render — Reanimated treats a render-phase shared-value
  // write as undefined behaviour, and under StrictMode's double render it genuinely misbehaves.
  useEffect(() => {
    refreshingSV.value = refreshing;
  }, [refreshing, refreshingSV]);

  useEffect(() => {
    pinnedSV.value = pinned;
    // Becoming pinned must reveal the header now, not at the next scroll event: entering search
    // mode or an empty state fires no scroll, so a hidden header would simply stay gone.
    if (pinned) {
      state.value = INITIAL_HEADER_STATE;
      translateY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    }
  }, [pinned, pinnedSV, state, translateY]);

  const measuredRef = useRef(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    headerH.value = h;
    // Sub-pixel onLayout churn is routine on react-native-web; without this guard the
    // setState → re-render → onLayout loop never settles.
    if (Math.abs(h - measuredRef.current) > 0.5) {
      measuredRef.current = h;
      setHeaderHeight(h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => {
      'worklet';
      const next = nextHeaderState(
        state.value,
        {
          offsetY: e.contentOffset.y,
          viewportHeight: e.layoutMeasurement.height,
          contentHeight: e.contentSize.height,
          headerHeight: headerH.value,
          pinned: pinnedSV.value,
          refreshing: refreshingSV.value,
        },
        cfg,
      );
      if (next.shown !== state.value.shown) {
        // withTiming, not withSpring: a spring overshoots past -H, and there is nothing above the
        // header, so every hide would flash a band of background at the top of the screen.
        translateY.value = withTiming(next.shown ? 0 : -headerH.value, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
      }
      state.value = next;
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // paddingTop is the measured header alone. The gap between the header and the first row lives
  // inside the header (CollapsingHeader's `gapBelow`) rather than here, so it cannot scroll away
  // and let a card ride up flush against the filter chips.
  const contentContainerStyle = useMemo<ViewStyle>(
    () => ({ paddingTop: headerHeight, paddingBottom: contentBottomPadding }),
    [headerHeight, contentBottomPadding],
  );

  return {
    /** Spread onto `<CollapsingHeader>`. */
    headerProps: { onLayout, animatedStyle },
    /** Spread onto `<AnimatedSectionList>`. */
    listProps: {
      onScroll: scrollHandler,
      // Mandatory, not cosmetic: react-native-web gates scroll emission on `eventThrottle > 0`
      // and would otherwise fire exactly one scroll event ever. iOS behaves the same at 0.
      scrollEventThrottle: 16,
      contentContainerStyle,
    },
    /** Measured px; 0 until first layout. For RefreshControl and non-list body branches. */
    headerHeight,
  };
}
