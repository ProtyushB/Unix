import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Title + subtitle block. The title size is deliberately identical on every
// auth screen so they read as one family when flicked through.

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    block: {
      gap: 9,
    },
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 28,
      lineHeight: 34,
      color: theme.palette.onBackground,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 14.5,
      lineHeight: 21,
      color: theme.palette.muted,
    },
  });
}

export default AuthHeader;
