import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Order {
  id: number;
  customerId: number;
  customerName?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OrderCard({ order, onPress }: OrderCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Left: Order number + customer */}
      <View style={styles.info}>
        <Text style={styles.orderNum}>#{order.id}</Text>
        {order.customerName ? (
          <Text style={styles.customer} numberOfLines={1}>
            {order.customerName}
          </Text>
        ) : null}
      </View>

      {/* Middle: Amount */}
      <Text style={styles.amount}>{formatCurrency(order.totalAmount)}</Text>

      {/* Right: Status + date */}
      <View style={styles.trailing}>
        <StatusPill status={order.status} />
        <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.surface + '99',
      borderWidth: 1,
      borderColor: theme.palette.divider + '80',
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    info: {
      flex: 1,
      marginRight: 10,
    },
    orderNum: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginBottom: 2,
    },
    customer: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    amount: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginRight: 12,
    },
    trailing: {
      alignItems: 'flex-end',
      gap: 6,
    },
    date: {
      fontSize: 11,
      color: theme.palette.muted,
    },
  });
}
