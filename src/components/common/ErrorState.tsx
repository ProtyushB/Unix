import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { AppButton } from './AppButton';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <AlertTriangle size={28} color="#ef4444" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  message: {
    fontSize: 14,
    color: '#fca5a5',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  button: {
    minWidth: 120,
  },
});
