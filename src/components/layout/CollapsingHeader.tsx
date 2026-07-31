import React from 'react';
import { View, SectionList, StyleSheet } from 'react-native';
import type { LayoutChangeEvent, ViewProps, SectionListProps } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedProps } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Animated SectionList ────────────────────────────────────────────────────
//
// MODULE SCOPE, deliberately. `createAnimatedComponent` returns a NEW component type on every
// call, so building it inside a component body makes React see a different `type` each render and
// remount the whole list — scroll offset back to zero, every cell destroyed, and `onEndReached`
// refiring into a spurious page fetch. `FAB.tsx:15` sets the same precedent.
//
// Reanimated 4 ships no `Animated.SectionList`, so this is the only route. It works because RN's
// SectionList implements `getScrollableNode()`, which is what the native events manager resolves
// the view tag from.

const AnimatedSectionListBase = Animated.createAnimatedComponent(SectionList);

/**
 * `createAnimatedComponent` erases SectionList's generic, and the two screens using this have
 * different row types. Rather than casting at both call sites, the ugliness lives here once.
 */
export const AnimatedSectionList = AnimatedSectionListBase as unknown as <ItemT, SectionT>(
  props: SectionListProps<ItemT, SectionT> & {
    onScroll?: unknown;
    scrollEventThrottle?: number;
  },
) => React.ReactElement;

// ─── Header ──────────────────────────────────────────────────────────────────

interface CollapsingHeaderProps {
  /** From `useCollapsingHeader().headerProps`. */
  onLayout: (e: LayoutChangeEvent) => void;
  /** The `useAnimatedStyle` result — a shared-value-backed style, not a plain one. */
  animatedStyle: AnimatedProps<ViewProps>['style'];
  /** Opaque, or list rows show through the header as it translates over them. */
  backgroundColor: string;
  /**
   * Breathing room between the header's last element and the first row.
   *
   * It belongs to the header, not to the list's content padding. Content padding scrolls away with
   * the rows, so a card riding up under the header would touch the filter chips with nothing
   * between them. Held here it is part of the opaque header, so the buffer survives scrolling —
   * and because it is inside the measured box, the list's inset still lands in exactly the same
   * place at rest.
   */
  gapBelow?: number;
  children: React.ReactNode;
}

/**
 * The auto-hiding header overlay.
 *
 * The header is absolutely positioned rather than laid out above the list, because the mockups
 * want it to come back on an upward scroll mid-list — which a `ListHeaderComponent` structurally
 * cannot do. Overlaying also keeps the header out of the virtualized cell tree, so the search
 * field and the horizontal chip ScrollViews keep stable identity and never lose focus.
 *
 * Two constraints that are load-bearing rather than stylistic:
 *
 *   1. The wrapper sets `top/left/right` and NO `height`, `bottom` or `maxHeight`. Any of those
 *      turns this back into a height-constrained flex column, which is exactly what once crushed
 *      Orders' 30px chip rows to ~8px. Leaving it unconstrained makes that failure impossible.
 *   2. `pointerEvents="box-none"` — the wrapper spans the header's full width, so `"none"` would
 *      make the chips and the search box untappable, and the default would swallow taps in the
 *      area the header vacates once hidden.
 *
 * Clipping lives on this wrapper and not on the screen root: a translated absolute child is not
 * clipped by default and would paint up over the status bar, but putting `overflow: hidden` on the
 * root would also clip the FAB's shadow.
 *
 * The safe-area offset is applied HERE, on the wrapper's `top`, and the reason is load-bearing.
 * Both call sites render this inside `<SafeAreaView edges={['top', ...]}>`, but safe-area-context
 * applies its inset as Yoga PADDING, and an absolutely positioned child resolves `top` against the
 * parent's padding box — i.e. the border edge, outside the padding. So the inset does not reach an
 * absolute child at all, and `top: 0` lands under the status bar. Reading the insets here is the fix.
 *
 * It must be `top` and NOT `paddingTop` on this wrapper. Padding would grow the clip box by the
 * inset while the child still only translates by its own height, so every hide would leave a strip
 * of header stranded at the top of the screen. Offsetting the origin keeps the collapse geometry
 * identical to before.
 *
 * It also has to stay off the inner Animated.View, because `onLayout` is bound there and the list
 * reserves exactly that measured height. Padding the inner view would fold the inset into
 * `headerHeight` and force a matching subtraction in useCollapsingHeader, RefreshControl's
 * progressViewOffset, and both screens' hero/skeleton insets. Measuring the content alone keeps all
 * four correct with no arithmetic.
 */
export function CollapsingHeader({
  onLayout,
  animatedStyle,
  backgroundColor,
  gapBelow = 0,
  children,
}: CollapsingHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.clip, { top: insets.top, left: insets.left, right: insets.right }]}
    >
      <Animated.View
        onLayout={onLayout}
        style={[{ backgroundColor, paddingBottom: gapBelow }, animatedStyle]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    // `top` / `left` / `right` are supplied by the component from the safe-area insets — see the
    // doc comment above. Deliberately absent here so they cannot be silently reset to 0.
    position: 'absolute',
    overflow: 'hidden',
    // Below the FAB's 100 so it never covers it; they do not overlap geometrically anyway.
    zIndex: 10,
  },
});
