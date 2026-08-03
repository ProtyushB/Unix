import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { StatusPill } from '../common/StatusPill';
import { TimeChip } from './TimeChip';
import { formatCurrency, formatTimeParts } from '../../utils/formatters';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RecentOrder {
  id: number | string;
  customerName: string;
  orderNumber: string;
  amount: number;
  status: string;
  when: string | null;
}

interface RecentOrderRowProps {
  order: RecentOrder;
  /** Bottom hairline — omitted on the last row so the card edge stays clean. */
  divided: boolean;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `WeOqF`: time chip | customer + order number | amount + status.

export function RecentOrderRow({ order, divided, onPress }: RecentOrderRowProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}
    >
      <TimeChip parts={formatTimeParts(order.when)} />

      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {order.customerName}
        </Text>
        <Text style={styles.number} numberOfLines={1}>
          {order.orderNumber}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount} numberOfLines={1}>
          {formatCurrency(order.amount)}
        </Text>
        <StatusPill status={order.status} />
      </View>
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    divided: {
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    pressed: {
      backgroundColor: theme.colors.softBg,
    },
    mid: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
    },
    number: {
      fontSize: 11.5,
      fontWeight: '500',
      color: theme.palette.muted,
    },
    right: {
      alignItems: 'flex-end',
      gap: 5,
    },
    amount: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
    },
  });
}
