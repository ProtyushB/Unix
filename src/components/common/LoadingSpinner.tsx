import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  overlay?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LoadingSpinner({
  size = 'large',
  color = '#f97316',
  overlay = false,
}: LoadingSpinnerProps) {
  if (overlay) {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
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
