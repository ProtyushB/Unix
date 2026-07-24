import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// The muted "← Back to sign in" link that closes out every recovery screen.
// Distinct from AuthTopBack: that one steps back one screen, this one leaves
// the flow entirely.

interface AuthBackLinkProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function AuthBackLink({ label, onPress, disabled = false }: AuthBackLinkProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <ArrowLeft size={16} color={palette.muted} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    label: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: theme.palette.muted,
    },
  });
}

export default AuthBackLink;
