import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListGridTileProps {
  title:     string;
  price?:    string;
  meta?:     string;
  /** Status key from theme.status. If omitted, meta is muted plain text. */
  statusKey?: string;
  icon:       LucideIcon;
  onPress?:   () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
// Pattern C: 2-column grid tile. Visual block on top (icon placeholder until
// real images land), name/price/meta below. Designed to live inside a FlatList
// with numColumns={2}.

export function ListGridTile({
  title,
  price,
  meta,
  statusKey,
  icon: Icon,
  onPress,
}: ListGridTileProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const statusColors = statusKey ? theme.status[statusKey] : null;
  const metaColor    = statusColors?.text ?? theme.palette.muted;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.palette.divider }}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={styles.imageBlock}>
        <Icon size={32} color={theme.colors.primary} strokeWidth={1.5} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {price && <Text style={styles.price}>{price}</Text>}
        {meta && (
          <Text style={[styles.meta, { color: metaColor }]} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tile: {
      flex:            1,
      backgroundColor: theme.palette.surface,
      borderWidth:     1,
      borderColor:     theme.palette.divider,
      borderRadius:    14,
      overflow:        'hidden',
      margin:          6,
      ...theme.elevation.low,
    },
    tilePressed: {
      opacity: 0.7,
    },
    imageBlock: {
      aspectRatio:     1,
      backgroundColor: theme.colors.softBg,
      alignItems:      'center',
      justifyContent:  'center',
    },
    body: {
      paddingHorizontal: 10,
      paddingVertical:   10,
      gap:               2,
    },
    title: {
      fontSize:   14,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    price: {
      fontSize:   13,
      fontWeight: '600',
      color:      theme.palette.onBackground,
    },
    meta: {
      fontSize:   11,
      fontWeight: '600',
    },
  });
}
