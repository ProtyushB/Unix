import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePlus, X } from 'lucide-react-native';
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
  onAdd?: () => void;
  onRemove?: (index: number) => void;
}

/**
 * A product's or service's images while they are being EDITED: a row of 78px squares led by an Add
 * tile. Here the photos are inputs sitting above a form, so they stay small — a full-bleed stage
 * would push every field below the fold.
 *
 * Reading is a different component, not this one with a flag: `ImageStage` draws a 3:4 stage that
 * pages and never crops. This used to carry that mode too, as a 160-tall `cover` hero, which
 * cropped; nothing renders it any more.
 */
export function MediaStrip({ uris, onAdd, onRemove }: MediaStripProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
