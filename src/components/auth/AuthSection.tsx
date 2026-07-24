import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Accent icon + section title, used to break the longer onboarding forms into
// named parts (mockups 11 / 12).

interface AuthSectionProps {
  icon: LucideIcon;
  title: string;
}

export function AuthSection({ icon: Icon, title }: AuthSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <Icon size={21} color={colors.primary} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 18,
      color: theme.palette.onBackground,
    },
  });
}

export default AuthSection;
