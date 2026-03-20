import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { darkPalette, themes } from '../../theme/colors';

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
  color = themes.default.primary,
  height = 8,
  label,
}: ProgressBarProps) {
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
              backgroundColor: color,
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    backgroundColor: darkPalette.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  label: {
    fontSize: 12,
    color: darkPalette.muted,
    marginTop: 6,
    textAlign: 'right',
  },
});
