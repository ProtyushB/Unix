import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

interface SaveProgressOverlayProps {
  visible: boolean;
  percent: number;
  label: string;
}

/**
 * Blocking progress while a save runs.
 *
 * Blocking on purpose: a create with images is a two-phase operation (record, then upload) and a
 * second tap partway through would start a second record. There is no cancel for the same reason —
 * the record may already exist by the time the user changes their mind.
 *
 * ⚠️ Never mount this while a sheet or ConfirmDialog is up. react-native-web keeps a Modal's portal
 * mounted after `visible` flips false, so two overlapping Modals leave an invisible layer eating
 * taps. Everything that raises a Modal on this screen drops the previous one first.
 */
export function SaveProgressOverlay({ visible, percent, label }: SaveProgressOverlayProps) {
  const styles = useThemedStyles(createStyles);
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.label}>{label}</Text>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: clamped }}
          >
            <View style={[styles.fill, { width: `${clamped}%` }]} />
          </View>
          <Text style={styles.percent}>{clamped}%</Text>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: theme.palette.overlay,
    },
    card: {
      width: '100%',
      gap: 12,
      padding: 20,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    label: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    track: {
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.palette.divider,
    },
    fill: { height: 6, borderRadius: 999, backgroundColor: theme.colors.primary },
    percent: { fontSize: 12, color: theme.palette.muted },
  });
}
