import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Bill {
  id: number;
  customerName?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  onDownload?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BillCard({ bill, onPress, onDownload }: BillCardProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Left: Bill number + customer */}
      <View style={styles.info}>
        <Text style={styles.billNum}>#{bill.id}</Text>
        {bill.customerName ? (
          <Text style={styles.customer} numberOfLines={1}>
            {bill.customerName}
          </Text>
        ) : null}
      </View>

      {/* Middle: Amount */}
      <Text style={styles.amount}>{formatCurrency(bill.totalAmount)}</Text>

      {/* Right: Status + date + download */}
      <View style={styles.trailing}>
        <StatusPill status={bill.status} />
        <Text style={styles.date}>{formatDate(bill.createdAt)}</Text>
      </View>

      {onDownload ? (
        <TouchableOpacity
          onPress={onDownload}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.downloadBtn}
        >
          <Download size={18} color={palette.muted} />
        </TouchableOpacity>
      ) : null}
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
    billNum: {
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
      marginRight: 8,
    },
    date: {
      fontSize: 11,
      color: theme.palette.muted,
    },
    downloadBtn: {
      padding: 6,
    },
  });
}
