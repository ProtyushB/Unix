import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

/**
 * `neutral` is an outlined chip; every other tone is a tinted fill.
 *
 * The distinction is the point: a product's type and a service's "Normal" are just labels, while
 * Tracked, Available and Appointment-required are states worth spotting at a glance.
 */
export type BadgeTone = 'neutral' | 'accent' | 'info' | 'success' | 'error';

/** A title-block badge, sitting under the name and price. */
export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const color = toneColor(theme, tone);

  if (!color) {
    return (
      <View style={styles.neutral}>
        <Text style={styles.neutralLabel}>{label}</Text>
      </View>
    );
  }
  return (
    // The '22' suffix is the fill's alpha — the same tint the mockups use for every soft chip.
    <View style={[styles.tinted, { backgroundColor: color + '22' }]}>
      <Text style={[styles.tintedLabel, { color }]}>{label}</Text>
    </View>
  );
}

function toneColor(theme: AppTheme, tone: BadgeTone): string | null {
  switch (tone) {
    case 'accent':
      return theme.colors.primary;
    case 'info':
      return theme.palette.info;
    case 'success':
      return theme.palette.success;
    case 'error':
      return theme.palette.error;
    default:
      return null;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    neutral: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    neutralLabel: { fontSize: 11, fontWeight: '600', color: theme.palette.muted },
    tinted: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    tintedLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  });
}
