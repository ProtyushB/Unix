import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { TimeParts } from '../../utils/formatters';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimeChipProps {
  parts: TimeParts | null;
  /**
   * `neutral` — elevated surface fill (order rows, node `GuqCS`).
   * `accent`  — accent-tinted fill (appointment rows, node `D97K55`).
   */
  variant?: 'neutral' | 'accent';
}

// ─── Component ──────────────────────────────────────────────────────────────
// Fixed-width three-line stack: time / meridiem / date.

export function TimeChip({ parts, variant = 'neutral' }: TimeChipProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const background = variant === 'accent' ? colors.primary + '1F' : palette.surfaceElevated;

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <Text style={styles.time}>{parts?.time ?? '--:--'}</Text>
      <Text style={styles.meridiem}>{parts?.meridiem ?? ''}</Text>
      <Text style={styles.date}>{parts?.date ?? ''}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    chip: {
      width: 58,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      paddingVertical: 7,
      borderRadius: 12,
    },
    time: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    meridiem: {
      fontSize: 9,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    date: {
      fontSize: 9,
      fontWeight: '500',
      color: theme.palette.muted,
    },
  });
}
