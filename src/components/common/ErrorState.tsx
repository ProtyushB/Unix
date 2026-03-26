import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { AppButton } from './AppButton';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <AlertTriangle size={28} color={palette.error} />
        <Text style={styles.message}>{message}</Text>
        {onRetry ? (
          <AppButton
            title="Retry"
            onPress={onRetry}
            variant="danger"
            style={styles.button}
          />
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: theme.palette.error + '14',
      borderWidth: 1,
      borderColor: theme.palette.error + '33',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      width: '100%',
    },
    message: {
      fontSize: 14,
      color: theme.palette.error + 'CC',
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 12,
      marginBottom: 16,
    },
    button: {
      minWidth: 120,
    },
  });
}
