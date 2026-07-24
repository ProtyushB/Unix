import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Lock, Headset, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivationPendingPanelProps {
  businessName: string | null;
  refreshing: boolean;
  onRefreshStatus: () => void;
  onContactSupport: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `z9uSIF` (Dashboard 2 — Activation Pending). Shown instead of the
// whole dashboard while the business has `isPaymentVerified === false` — the
// same gate the Centrix owner portal applies (OwnerPortal.jsx:1659).
//
// NOTE: the Plan / Amount / Reference values below are HARDCODED placeholders
// from the mockup. Payment is manual and out-of-band, so the client has no real
// source for them — only the Status row is truthful. Wire these to a backend
// field if/when one exists.
const PLACEHOLDER_PLAN      = 'Growth · Monthly';
const PLACEHOLDER_AMOUNT    = '₹2,499';
const PLACEHOLDER_REFERENCE = 'PAY-8842193';

export function ActivationPendingPanel({
  businessName,
  refreshing,
  onRefreshStatus,
  onContactSupport,
}: ActivationPendingPanelProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.lockBadge}>
          <Lock size={32} color={palette.warning} />
        </View>

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Activation Pending</Text>
          <Text style={styles.body}>
            {businessName ? `${businessName} is set up — ` : ''}
            we're verifying your payment. Your dashboard unlocks automatically
            once it clears, usually within a few minutes.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Plan</Text>
            <Text style={styles.rowValue}>{PLACEHOLDER_PLAN}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Amount</Text>
            <Text style={[styles.rowValue, styles.mono]}>{PLACEHOLDER_AMOUNT}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Reference</Text>
            <Text style={[styles.rowValueMuted, styles.mono]}>
              {PLACEHOLDER_REFERENCE}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <View style={styles.statusPill}>
              <View style={styles.dot} />
              <Text style={styles.statusText}>Pending verification</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onContactSupport}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Headset size={17} color={colors.onAccent} />
            <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>
              Contact Support
            </Text>
          </Pressable>

          <Pressable
            onPress={onRefreshStatus}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.secondaryBtn,
              (pressed || refreshing) && styles.pressed,
            ]}
          >
            <RefreshCw size={16} color={palette.muted} />
            <Text style={styles.secondaryLabel}>
              {refreshing ? 'Refreshing…' : 'Refresh Status'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          You'll be notified as soon as your account is active.
        </Text>
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
    panel: {
      alignSelf: 'stretch',
      alignItems: 'center',
      gap: 20,
    },
    lockBadge: {
      width: 78,
      height: 78,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.warning + '22',
      borderWidth: 1,
      borderColor: theme.palette.warning + '33',
    },
    headingBlock: {
      alignSelf: 'stretch',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    body: {
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      color: theme.palette.muted,
    },
    card: {
      alignSelf: 'stretch',
      gap: 13,
      padding: 16,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    rowLabel: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    rowValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.palette.onBackground,
      flexShrink: 1,
      textAlign: 'right',
    },
    rowValueMuted: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.palette.muted,
      flexShrink: 1,
      textAlign: 'right',
    },
    mono: {
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    divider: {
      height: 1,
      backgroundColor: theme.palette.divider,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: theme.palette.warning + '22',
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.palette.warning,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.palette.warning,
    },
    actions: {
      alignSelf: 'stretch',
      gap: 10,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    secondaryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.muted,
    },
    note: {
      fontSize: 11,
      textAlign: 'center',
      color: theme.palette.muted,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
