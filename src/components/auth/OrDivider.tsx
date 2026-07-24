import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

interface OrDividerProps {
  label?: string;
}

export function OrDivider({ label = 'Or continue with' }: OrDividerProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: theme.palette.divider,
    },
    label: {
      fontFamily: 'Inter-Regular',
      fontSize: 12.5,
      color: theme.palette.muted,
    },
  });
}

export default OrDivider;
