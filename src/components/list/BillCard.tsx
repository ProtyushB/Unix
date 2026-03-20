import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';
import { darkPalette } from '../../theme/colors';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';

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
          <Download size={18} color={darkPalette.muted} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
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
    color: darkPalette.text,
    marginBottom: 2,
  },
  customer: {
    fontSize: 12,
    color: darkPalette.muted,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: darkPalette.text,
    marginRight: 12,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 6,
    marginRight: 8,
  },
  date: {
    fontSize: 11,
    color: darkPalette.muted,
  },
  downloadBtn: {
    padding: 6,
  },
});
