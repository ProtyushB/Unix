import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AppCard({ children, style }: AppCardProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.palette.surface + '99',
      borderWidth: 1,
      borderColor: theme.palette.divider + '80',
      borderRadius: 16,
      padding: 16,
    },
  });
}

export default AppCard;
