import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../hooks/useTheme';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListRowDenseProps {
  title:     string;
  subtitle?: string;
  trailing?: string;
  sub?:      string;
  onPress?:  () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
// Pattern B: Dense two-line row. Primary title and metadata on the left,
// trailing amount + small sub on the right. Divider-separated, not carded —
// optimised for long scrolling history.

export function ListRowDense({
  title,
  subtitle,
  trailing,
  sub,
  onPress,
}: ListRowDenseProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: palette.divider }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {(trailing || sub) && (
        <View style={styles.right}>
          {trailing && <Text style={styles.trailing}>{trailing}</Text>}
          {sub && <Text style={styles.sub}>{sub}</Text>}
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingVertical:   12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.palette.divider,
      gap:               12,
    },
    rowPressed: {
      backgroundColor: theme.palette.surface,
    },
    left: {
      flex: 1,
      gap:  2,
    },
    title: {
      fontSize:   14,
      fontWeight: '600',
      color:      theme.palette.onBackground,
    },
    subtitle: {
      fontSize: 12,
      color:    theme.palette.muted,
    },
    right: {
      alignItems: 'flex-end',
      gap:        2,
    },
    trailing: {
      fontSize:   14,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    sub: {
      fontSize: 11,
      color:    theme.palette.muted,
    },
  });
}
