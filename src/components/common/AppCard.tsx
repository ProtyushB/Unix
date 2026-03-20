import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AppCard({ children, style }: AppCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: 16,
    padding: 16,
  },
});
