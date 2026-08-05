import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

interface SwitchRowProps {
  label: string;
  /** The consequence of the switch, in plain words. Both of these settings need one. */
  explainer?: string;
  value: boolean;
  editable: boolean;
  onChange?: (next: boolean) => void;
  /** Read-mode wording, since "On"/"Off" suits tracking but not "Requires an order". */
  readLabels?: [on: string, off: string];
  /**
   * Whether the "on" reading is tinted green. True for a state the owner would want to spot —
   * Tracking · On — and false for a plain answer, which is why the mockup draws Billing's "Yes" in
   * the ordinary text colour.
   */
  tintOn?: boolean;
}

/**
 * A boolean setting with its consequence spelled out underneath.
 *
 * In read mode this collapses to a label and a word rather than a disabled switch — a greyed-out
 * control invites tapping and then does nothing.
 */
export function SwitchRow({
  label,
  explainer,
  value,
  editable,
  onChange,
  readLabels = ['On', 'Off'],
  tintOn = true,
}: SwitchRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!editable) {
    // Same one-line label/value shape as DetailField's row. "Off" is always muted — it is the
    // absence of the thing — so only the "on" reading takes a colour decision.
    const onColor = tintOn ? theme.palette.success : theme.palette.onSurface;
    return (
      <View style={styles.readRow}>
        <Text style={styles.readLabel}>{label}</Text>
        <Text style={[styles.readValue, { color: value ? onColor : theme.palette.muted }]}>
          {value ? readLabels[0] : readLabels[1]}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.editRow}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {explainer ? <Text style={styles.explainer}>{explainer}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.palette.divider, true: theme.colors.primary }}
        thumbColor={theme.palette.surface}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    readRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    readLabel: { fontSize: 13, color: theme.palette.muted },
    readValue: { fontSize: 13, fontWeight: '500' },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    copy: { flex: 1, gap: 3 },
    label: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    explainer: { fontSize: 11.5, color: theme.palette.muted, lineHeight: 16 },
  });
}
