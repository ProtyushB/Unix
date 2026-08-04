import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImageIcon, ImagePlus, X } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

interface MediaStripProps {
  /**
   * Already-resolved image URIs. Deliberately not DMS ids: how a `dmsFileId` becomes something
   * `<Image>` can show is still unproven against a real backend, and this component should not
   * have to change when that is settled. See `useProductImages`.
   */
  uris: string[];
  editable?: boolean;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
}

/**
 * The product's images.
 *
 * The two modes are drawn as different things, not as one thing with a disabled state. Reading is a
 * single full-width 160-tall hero — the photo is the first thing on the screen and deserves the
 * room. Editing is a row of 78px squares led by an Add tile, because there the photos are inputs
 * sitting above a form and a hero would push every field below the fold.
 */
export function MediaStrip({ uris, editable = false, onAdd, onRemove }: MediaStripProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  // Measured rather than assumed: the hero pages one image per swipe, so a tile has to be exactly
  // as wide as the scroll view and only the layout knows that number.
  const [heroWidth, setHeroWidth] = useState(0);

  if (!editable) {
    return (
      <View style={styles.hero} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
        {uris.length === 0 ? (
          // A bare glyph, no caption. A product with no photo is the common case, and labelling it
          // "No images" states the obvious twice.
          <View style={styles.heroEmpty}>
            <ImageIcon size={38} color={theme.palette.muted} />
          </View>
        ) : uris.length === 1 || heroWidth === 0 ? (
          <Image source={{ uri: uris[0] }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {uris.map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={{ uri }}
                style={[styles.heroImage, { width: heroWidth }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* Add comes first, so its position never moves as photos are added and removed. */}
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          style={styles.addTile}
          accessibilityRole="button"
          accessibilityLabel="Add image"
        >
          <ImagePlus size={22} color={theme.palette.muted} />
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      ) : null}

      {uris.map((uri, i) => (
        <View key={`${uri}-${i}`} style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(i)}
              hitSlop={8}
              style={styles.removeButton}
              accessibilityRole="button"
              accessibilityLabel={`Remove image ${i + 1}`}
            >
              <X size={11} color={theme.colors.onAccent ?? '#FFFFFF'} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    // ── Read: one full-width hero ────────────────────────────────────────────
    hero: {
      height: 160,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    heroImage: { flex: 1, height: '100%' },

    // ── Edit: a row of squares ───────────────────────────────────────────────
    row: { gap: 10 },
    thumbWrap: { width: 78, height: 78 },
    thumb: {
      width: 78,
      height: 78,
      borderRadius: 12,
      backgroundColor: theme.palette.surfaceElevated,
    },
    removeButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.error,
    },
    addTile: {
      width: 78,
      height: 78,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    addLabel: { fontSize: 10.5, color: theme.palette.muted },
  });
}
