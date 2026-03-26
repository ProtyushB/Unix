import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { formatDate } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

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

function getQuantityColor(
  remaining: number,
  purchased: number,
  palette: AppTheme['palette'],
): string {
  if (purchased === 0) return palette.muted;
  const ratio = remaining / purchased;
  if (ratio > 0.5) return palette.success;
  if (ratio >= 0.2) return palette.warning;
  return palette.error;
}

function getExpiryInfo(
  expiryDate: string,
  palette: AppTheme['palette'],
): { color: string; isExpired: boolean } {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { color: palette.error, isExpired: true };
  }
  if (diffDays <= 30) {
    return { color: palette.error, isExpired: false };
  }
  return { color: palette.muted, isExpired: false };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InventoryBatchCard({
  batch,
  onPress,
  onEdit,
  onDelete,
}: InventoryBatchCardProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const quantityColor = useMemo(
    () => getQuantityColor(batch.remainingQuantity, batch.purchasedQuantity, palette),
    [batch.remainingQuantity, batch.purchasedQuantity, palette],
  );

  const expiryInfo = useMemo(
    () => getExpiryInfo(batch.expiryDate, palette),
    [batch.expiryDate, palette],
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
                <Pencil size={16} color={palette.muted} />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                onPress={onDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.actionBtn}
              >
                <Trash2 size={16} color={palette.error} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.palette.surface + '99',
      borderWidth: 1,
      borderColor: theme.palette.divider + '80',
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
      color: theme.palette.onBackground,
      marginBottom: 2,
    },
    batchNum: {
      fontSize: 12,
      color: theme.palette.muted,
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
      color: theme.palette.muted,
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
      backgroundColor: theme.palette.divider + '80',
      borderRadius: 8,
    },
  });
}
