import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
  label?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProgressBar({
  progress,
  color,
  height = 8,
  label,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fillColor = color ?? colors.primary;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const percentage = Math.round(clampedProgress * 100);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              height,
              borderRadius: height / 2,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      {label !== undefined ? (
        <Text style={styles.label}>{label ?? `${percentage}%`}</Text>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      width: '100%',
    },
    track: {
      backgroundColor: theme.palette.divider,
      overflow: 'hidden',
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
    },
    label: {
      fontSize: 12,
      color: theme.palette.muted,
      marginTop: 6,
      textAlign: 'right',
    },
  });
}
