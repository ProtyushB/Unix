import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusPillProps {
  status: string;
}

// ─── Status Color Map ───────────────────────────────────────────────────────

interface StatusStyle {
  bg: string;
  text: string;
}

const STATUS_MAP: Record<string, StatusStyle> = {
  // Green
  ACTIVE: { bg: '#10b98120', text: '#10b981' },
  PAID: { bg: '#10b98120', text: '#10b981' },
  COMPLETED: { bg: '#10b98120', text: '#10b981' },

  // Amber
  PENDING: { bg: '#f59e0b20', text: '#f59e0b' },
  SCHEDULED: { bg: '#f59e0b20', text: '#f59e0b' },
  CONFIRMED: { bg: '#f59e0b20', text: '#f59e0b' },

  // Red
  CANCELLED: { bg: '#ef444420', text: '#ef4444' },
  EXPIRED: { bg: '#ef444420', text: '#ef4444' },
  DEPLETED: { bg: '#ef444420', text: '#ef4444' },

  // Slate
  ON_HOLD: { bg: '#64748b20', text: '#64748b' },
  QUARANTINED: { bg: '#64748b20', text: '#64748b' },

  // Orange
  UNPAID: { bg: '#f9731620', text: '#f97316' },
  PARTIALLY_PAID: { bg: '#f9731620', text: '#f97316' },
};

const FALLBACK: StatusStyle = { bg: '#64748b20', text: '#64748b' };

function getStatusStyle(status: string): StatusStyle {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  return STATUS_MAP[normalized] ?? FALLBACK;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatusPill({ status }: StatusPillProps) {
  const colors = getStatusStyle(status);

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
