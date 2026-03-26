import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PasswordMatchProps {
  password: string;
  confirmPassword: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PasswordMatch({ password, confirmPassword }: PasswordMatchProps) {
  const styles = useThemedStyles(createStyles);

  if (!confirmPassword) {
    return null;
  }

  const matches = password === confirmPassword;

  return (
    <View style={styles.container}>
      {matches ? (
        <>
          <Text style={styles.iconMatch}>✓</Text>
          <Text style={styles.matchText}>Passwords match</Text>
        </>
      ) : (
        <>
          <Text style={styles.iconMismatch}>✕</Text>
          <Text style={styles.mismatchText}>Passwords do not match</Text>
        </>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      marginBottom: 12,
    },
    iconMatch: {
      fontSize: 14,
      color: theme.palette.success,
    },
    iconMismatch: {
      fontSize: 14,
      color: theme.palette.error,
    },
    matchText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.palette.success,
    },
    mismatchText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.palette.error,
    },
  });
}

export default PasswordMatch;
