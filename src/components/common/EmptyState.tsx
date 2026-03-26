import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { AppButton } from './AppButton';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactElement;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <AppButton
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.button}
        />
      ) : null}
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
      paddingHorizontal: 32,
      paddingVertical: 48,
    },
    iconContainer: {
      marginBottom: 16,
      opacity: 0.6,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.palette.onBackground,
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: theme.palette.muted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    button: {
      minWidth: 160,
    },
  });
}
