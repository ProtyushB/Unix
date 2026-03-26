import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  /** Override spinner colour. Defaults to current theme primary. */
  color?: string;
  overlay?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LoadingSpinner({
  size = 'large',
  color,
  overlay = false,
}: LoadingSpinnerProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const spinnerColor = color ?? colors.primary;

  if (overlay) {
    return (
      <View style={[styles.overlay, { backgroundColor: palette.background + 'B3' }]}>
        <ActivityIndicator size={size} color={spinnerColor} />
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={spinnerColor} />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
    },
    inline: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
    },
  });
}
