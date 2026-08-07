import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ImageIcon, ImagePlus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import {
  STAGE_ASPECT_RATIO,
  THUMB_GAP,
  THUMB_SIZE,
  clampIndex,
  counterLabel,
  offsetForPage,
  pageIndexFromOffset,
  showsPager,
  showsThumbs,
  thumbStripOffset,
} from '../imageStage';

interface ImageStageProps {
  /** Already-resolved URIs, in display order. See `useProductImages` for why not DMS ids. */
  uris: string[];
  /** Adds the Add tile and the stage's Remove button. The photos themselves render identically. */
  editable?: boolean;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
}

/**
 * A product's or service's photos: a 3:4 portrait stage that pages.
 *
 * ONE component for both modes, and that is the point — a photo is judged at the size it will be
 * seen, so what you pick while editing is framed exactly as the customer-facing screen frames it.
 * Editing only adds two affordances; it changes nothing about how a photo is drawn.
 *
 * Every rule it follows is in `imageStage.ts`, including the one that matters most — the photo is
 * CONTAINED, never cropped. A landscape shot letterboxes, a tall shot pillarboxes, and the bars are
 * the stage's own surface so the frame stays legible either way.
 *
 * ⚠️ The stage is ~477pt on a 390pt phone, so in edit mode the first form field starts below the
 * fold. That is deliberate and was chosen over a shorter edit stage: a photo picker that shows the
 * photo smaller than the screen it feeds is how you end up shipping a badly framed hero.
 *
 * Paging is driven from two places that must not fight each other: swiping the stage moves the
 * thumbnails, tapping a thumbnail moves the stage. Both funnel through `activeRef` before they
 * scroll, so neither re-enters the handler that ran it.
 */
export function ImageStage({ uris, editable = false, onAdd, onRemove }: ImageStageProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const count = uris.length;
  const [active, setActive] = useState(0);
  // Measured, not assumed: a page has to be exactly as wide as the stage for `pagingEnabled` to
  // settle on whole photos, and only the layout knows that number.
  const [stageWidth, setStageWidth] = useState(0);

  const pagerRef = useRef<ScrollView>(null);
  const thumbsRef = useRef<ScrollView>(null);
  /**
   * The active index, mirrored where a callback can read it synchronously.
   *
   * `onScroll` fires every frame, so it needs to know whether the page actually CHANGED before
   * acting — re-issuing the same `scrollTo` on the thumbnail strip sixty times a second fights the
   * animation it started. Reading `active` here instead would need it in the dependency list,
   * rebuilding the handler on every page turn.
   *
   * It is also what stops the two strips from driving each other: tapping a thumbnail sets this
   * BEFORE scrolling the pager, so the `onScroll` that scroll provokes finds nothing to do.
   */
  const activeRef = useRef(0);

  const hasAdd = editable && !!onAdd;

  const syncTo = useCallback(
    (next: number) => {
      if (next === activeRef.current) return;
      activeRef.current = next;
      setActive(next);
      thumbsRef.current?.scrollTo({ x: thumbStripOffset(next, hasAdd), animated: true });
    },
    [hasAdd],
  );

  /**
   * Follow the list shrinking, which in edit mode happens on every Remove.
   *
   * Two things, and the scroll is the one that is easy to forget: removing the LAST photo while it
   * is on screen leaves both the index and the pager's scroll offset past the end — the counter
   * reads "5 / 4" and the stage sits on empty space the content no longer covers.
   */
  useEffect(() => {
    const next = clampIndex(activeRef.current, count);
    if (next === activeRef.current) return;
    activeRef.current = next;
    setActive(next);
    pagerRef.current?.scrollTo({ x: offsetForPage(next, stageWidth), animated: false });
  }, [count, stageWidth]);

  const onPagerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncTo(pageIndexFromOffset(e.nativeEvent.contentOffset.x, stageWidth, count));
    },
    [stageWidth, count, syncTo],
  );

  const onPickThumb = useCallback(
    (index: number) => {
      activeRef.current = index;
      setActive(index);
      pagerRef.current?.scrollTo({ x: offsetForPage(index, stageWidth), animated: true });
    },
    [stageWidth],
  );

  const pager = showsPager(count);
  const thumbs = showsThumbs(count, editable);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage} onLayout={(e) => setStageWidth(e.nativeEvent.layout.width)}>
        {count === 0 ? (
          // While editing the empty stage IS the Add button — a full-bleed target beats making the
          // user find the 60px tile below it. Reading, it is a bare glyph with no caption: a product
          // with no photo is the common case, and labelling it "No images" states the obvious twice.
          <Pressable
            onPress={hasAdd ? onAdd : undefined}
            disabled={!hasAdd}
            style={styles.empty}
            accessibilityRole={hasAdd ? 'button' : 'image'}
            accessibilityLabel={hasAdd ? 'Add an image' : 'No image'}
          >
            <ImageIcon size={44} color={theme.palette.muted} />
            {hasAdd ? <Text style={styles.emptyLabel}>Tap to add a photo</Text> : null}
          </Pressable>
        ) : (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            // Off until the width is known — a pager whose pages are 0 wide snaps every photo to
            // offset 0 and the swipe does nothing.
            scrollEnabled={pager && stageWidth > 0}
            showsHorizontalScrollIndicator={false}
            // Both, and `onScroll` is the load-bearing one: react-native-web never fires
            // `onMomentumScrollEnd` for a paged swipe, so on the web preview the counter and dots
            // would sit on the old photo forever. Tracking the scroll itself also reads better on
            // native — the dot moves with your thumb instead of snapping once the flick settles.
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onPagerScroll}
          >
            {uris.map((uri, i) => (
              <View
                key={`${uri}-${i}`}
                style={[styles.page, stageWidth > 0 && { width: stageWidth }]}
              >
                {/* `contain` IS the fit rule the mockup specifies — see `imageStage.ts`. Not
                    `cover`, which would crop exactly the products that were shot badly. */}
                <Image source={{ uri }} style={styles.photo} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        )}

        {/* Removes the photo ON THE STAGE, not one identified from a 60px crop. Sits opposite the
            counter so the two read as one row of chrome rather than two competing badges. */}
        {editable && onRemove && count > 0 ? (
          <Pressable
            onPress={() => onRemove(active)}
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel={`Remove image ${active + 1} of ${count}`}
          >
            <Trash2 size={13} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {pager ? (
          <>
            <View style={styles.counter} pointerEvents="none">
              <Text style={styles.counterLabel}>{counterLabel(active, count)}</Text>
            </View>

            <View style={styles.dotsRow} pointerEvents="none">
              <View style={styles.dots}>
                {uris.map((uri, i) => (
                  <View
                    key={`dot-${uri}-${i}`}
                    style={[styles.dot, i === active && styles.dotOn]}
                  />
                ))}
              </View>
            </View>
          </>
        ) : null}
      </View>

      {thumbs ? (
        <ScrollView
          ref={thumbsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbs}
        >
          {/* Add comes first, so its position never moves as photos are added and removed. */}
          {hasAdd ? (
            <Pressable
              onPress={onAdd}
              style={styles.addTile}
              accessibilityRole="button"
              accessibilityLabel="Add image"
            >
              <ImagePlus size={20} color={theme.palette.muted} />
              <Text style={styles.addLabel}>Add</Text>
            </Pressable>
          ) : null}

          {uris.map((uri, i) => (
            <Pressable
              key={`thumb-${uri}-${i}`}
              onPress={() => onPickThumb(i)}
              style={[styles.thumb, i === active && styles.thumbOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: i === active }}
              accessibilityLabel={`Show image ${i + 1} of ${count}`}
            >
              {/* Cropped on purpose, unlike the stage. A 60px square is too small to letterbox
                  legibly — contained thumbnails would be mostly bars. */}
              <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: { gap: THUMB_GAP },

    // ── The 3:4 stage ────────────────────────────────────────────────────────
    stage: {
      width: '100%',
      // Ratio rather than a fixed height, so the stage tracks the screen width with no measure pass
      // and no first-frame flash of a zero-height box.
      aspectRatio: STAGE_ASPECT_RATIO,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyLabel: { fontSize: 12.5, color: theme.palette.muted },
    // The page is the full stage; the photo is centred inside it by `contain`, so the leftover
    // letterbox/pillarbox area shows the stage's surface through.
    page: { height: '100%', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },

    // Deliberately NOT themed, here and on the dots and Remove below. This chrome sits on top of an
    // arbitrary photo, not on a surface — `palette.overlay` is a 15% sheen meant for scrims over
    // known backgrounds, and white-on-that would vanish against a pale product shot. A fixed dark
    // scrim with white on it is legible over anything, in all sixteen themes.
    counter: {
      position: 'absolute',
      top: 14,
      right: 14,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.65)',
    },
    counterLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },

    // Tinted with the error colour rather than plain black — it is the one destructive control on
    // the screen, and it needs to read as such before it is tapped, not after.
    removeButton: {
      position: 'absolute',
      top: 14,
      left: 14,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.error,
    },

    dotsRow: {
      position: 'absolute',
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    // The mockup draws these bare on a dark photo. They get the counter's scrim because a CONTAINED
    // photo letterboxes, and the bar they then sit on is the stage surface — light in half the
    // themes, where bare white dots would disappear entirely.
    dots: {
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF66',
    },
    dotOn: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FFFFFF' },

    // ── The thumbnail strip ──────────────────────────────────────────────────
    thumbs: { gap: THUMB_GAP },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    // The accent, not the mockup's literal orange — that orange is Parlour's, and this screen also
    // renders under fifteen other themes.
    thumbOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softBg },
    thumbImage: { width: '100%', height: '100%' },

    addTile: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.palette.divider,
    },
    addLabel: { fontSize: 10.5, color: theme.palette.muted },
  });
}
