import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListCardProps {
  title:      string;
  subtitle?:  string;
  meta?:      string;
  amount?:    string;
  status?:    string;
  /** SCREAMING_SNAKE status key used to pull color from theme.status, or a raw hex. */
  statusKey?: string;
  onPress?:   () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
// Pattern A: Rich card row. Leading accent bar keyed to status, primary title,
// secondary subtitle/meta, trailing amount + status pill.

export function ListCard({
  title,
  subtitle,
  meta,
  amount,
  status,
  statusKey,
  onPress,
}: ListCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const statusColors =
    statusKey && theme.status[statusKey]
      ? theme.status[statusKey]
      : status && theme.status[status]
        ? theme.status[status]
        : null;

  const accent = statusColors?.border ?? theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.palette.divider }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {status && statusColors && (
            <View style={[styles.pill, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
              <Text style={[styles.pillText, { color: statusColors.text }]}>{status}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
        <View style={styles.footRow}>
          {meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
          {amount && <Text style={styles.amount}>{amount}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      flexDirection:     'row',
      backgroundColor:   theme.palette.surface,
      borderWidth:       1,
      borderColor:       theme.palette.divider,
      borderRadius:      14,
      marginHorizontal:  16,
      marginBottom:      8,
      overflow:          'hidden',
      ...theme.elevation.low,
    },
    cardPressed: {
      opacity: 0.7,
    },
    accent: {
      width: 4,
    },
    body: {
      flex:              1,
      paddingHorizontal: 14,
      paddingVertical:   12,
      gap:               4,
    },
    headRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      gap:            8,
    },
    title: {
      flex:       1,
      fontSize:   15,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    subtitle: {
      fontSize: 13,
      color:    theme.palette.muted,
    },
    footRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginTop:      4,
      gap:            8,
    },
    meta: {
      flex:     1,
      fontSize: 12,
      color:    theme.palette.muted,
    },
    amount: {
      fontSize:   15,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    pill: {
      paddingHorizontal: 8,
      paddingVertical:   2,
      borderRadius:      6,
      borderWidth:       1,
    },
    pillText: {
      fontSize:      10,
      fontWeight:    '700',
      letterSpacing: 0.4,
    },
  });
}
