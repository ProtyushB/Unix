import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, TriangleAlert } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * `up` / `down` show the delta with an arrow. `flat` is the empty state's
 * "No change". `unavailable` is the error state's greyed "⚠ —".
 */
export type StatTrend = 'up' | 'down' | 'flat' | 'unavailable';

interface StatCardProps {
  value: string;
  label: string;
  /** Accent for the value text. Falls back to muted when `dimmed`. */
  valueColor: string;
  trend: StatTrend;
  /** Delta text, e.g. "12%". Ignored for flat/unavailable. */
  delta?: string;
  /** Empty / error states render the value in muted grey. */
  dimmed?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `q27kL`: centred value / label / trend stack in a bordered card.

export function StatCard({
  value,
  label,
  valueColor,
  trend,
  delta,
  dimmed = false,
}: StatCardProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const trendColor =
    trend === 'up' ? palette.success : trend === 'down' ? palette.error : palette.muted;

  return (
    <View style={styles.card}>
      <Text
        style={[styles.value, { color: dimmed ? palette.muted : valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.trend}>
        {trend === 'up' && <TrendingUp size={11} color={trendColor} />}
        {trend === 'down' && <TrendingDown size={11} color={trendColor} />}
        {trend === 'unavailable' && <TriangleAlert size={9} color={trendColor} />}
        <Text style={[styles.delta, { color: trendColor }]} numberOfLines={1}>
          {trend === 'flat' ? 'No change' : trend === 'unavailable' ? '—' : delta}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    value: {
      fontSize: 18,
      fontWeight: '700',
    },
    label: {
      fontSize: 10,
      fontWeight: '500',
      textAlign: 'center',
      color: theme.palette.muted,
    },
    trend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    delta: {
      fontSize: 9,
      fontWeight: '700',
    },
  });
}
