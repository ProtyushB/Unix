import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CloudOff, RefreshCw, LifeBuoy } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardErrorCardProps {
  /** Coarse failure code from the service, e.g. "ERR_NETWORK · 503". */
  code: string | null;
  onRetry: () => void;
  onContactSupport: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `cAY8R`: cloud-off badge, heading, copy, error-code chip,
// primary Try Again + ghost Contact Support.

export function DashboardErrorCard({
  code,
  onRetry,
  onContactSupport,
}: DashboardErrorCardProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <CloudOff size={26} color={palette.error} />
      </View>

      <Text style={styles.heading}>Couldn't load your dashboard</Text>
      <Text style={styles.message}>
        Something went wrong while fetching today's data. Check your connection
        and try again.
      </Text>

      {code ? (
        <View style={styles.codeChip}>
          <Text style={styles.codeText}>{code}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <RefreshCw size={16} color={colors.onAccent} />
          <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>Try Again</Text>
        </Pressable>

        <Pressable
          onPress={onContactSupport}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
        >
          <LifeBuoy size={15} color={palette.muted} />
          <Text style={styles.ghostLabel}>Contact Support</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 34,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    iconWrap: {
      width: 60,
      height: 60,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.error + '22',
      borderWidth: 1,
      borderColor: theme.palette.error + '30',
    },
    heading: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      color: theme.palette.onBackground,
    },
    message: {
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      color: theme.palette.muted,
    },
    codeChip: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.palette.surfaceElevated,
    },
    codeText: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.palette.muted,
    },
    actions: {
      alignSelf: 'stretch',
      gap: 9,
      paddingTop: 6,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      height: 40,
      borderRadius: 12,
    },
    ghostLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.palette.muted,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
