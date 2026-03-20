import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { darkPalette } from '../../theme/colors';
import { formatDate } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';

// ─── Types ──────────────────────────────────────────────────────────────────

interface InventoryBatch {
  id: number;
  productId: number;
  productName?: string;
  batchNumber: string;
  purchasedQuantity: number;
  remainingQuantity: number;
  expiryDate: string;
  status: string;
}

interface InventoryBatchCardProps {
  batch: InventoryBatch;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getQuantityColor(remaining: number, purchased: number): string {
  if (purchased === 0) return darkPalette.muted;
  const ratio = remaining / purchased;
  if (ratio > 0.5) return '#10b981';
  if (ratio >= 0.2) return '#f59e0b';
  return '#ef4444';
}

function getExpiryInfo(expiryDate: string): { color: string; isExpired: boolean } {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { color: '#ef4444', isExpired: true };
  }
  if (diffDays <= 30) {
    return { color: '#ef4444', isExpired: false };
  }
  return { color: darkPalette.muted, isExpired: false };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InventoryBatchCard({
  batch,
  onPress,
  onEdit,
  onDelete,
}: InventoryBatchCardProps) {
  const quantityColor = useMemo(
    () => getQuantityColor(batch.remainingQuantity, batch.purchasedQuantity),
    [batch.remainingQuantity, batch.purchasedQuantity],
  );

  const expiryInfo = useMemo(
    () => getExpiryInfo(batch.expiryDate),
    [batch.expiryDate],
  );

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Top Row: Product name + batch */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Text style={styles.productName} numberOfLines={1}>
            {batch.productName ?? `Product #${batch.productId}`}
          </Text>
          <Text style={styles.batchNum}>Batch: {batch.batchNumber}</Text>
        </View>
        <StatusPill status={batch.status} />
      </View>

      {/* Bottom Row: Quantity + Expiry + Actions */}
      <View style={styles.bottomRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Remaining</Text>
          <Text style={[styles.statValue, { color: quantityColor }]}>
            {batch.remainingQuantity}/{batch.purchasedQuantity}
          </Text>
        </View>

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Expiry</Text>
          <Text
            style={[
              styles.statValue,
              { color: expiryInfo.color },
              expiryInfo.isExpired && styles.expired,
            ]}
          >
            {formatDate(batch.expiryDate)}
          </Text>
        </View>

        {/* Actions */}
        {(onEdit || onDelete) ? (
          <View style={styles.actions}>
            {onEdit ? (
              <TouchableOpacity
                onPress={onEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.actionBtn}
              >
                <Pencil size={16} color={darkPalette.muted} />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                onPress={onDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.actionBtn}
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topLeft: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: darkPalette.text,
    marginBottom: 2,
  },
  batchNum: {
    fontSize: 12,
    color: darkPalette.muted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statCol: {
    marginRight: 20,
  },
  statLabel: {
    fontSize: 11,
    color: darkPalette.muted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  expired: {
    textDecorationLine: 'line-through',
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 10,
  },
  actionBtn: {
    padding: 6,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 8,
  },
});
