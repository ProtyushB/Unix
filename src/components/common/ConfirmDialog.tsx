import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { AppButton } from './AppButton';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <AppButton
              title={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              style={styles.button}
            />
            <AppButton
              title={confirmLabel}
              onPress={onConfirm}
              variant={danger ? 'danger' : 'primary'}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.palette.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    card: {
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 380,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: theme.palette.muted,
      lineHeight: 20,
      marginBottom: 24,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
    },
  });
}
