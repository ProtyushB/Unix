import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { FALLBACK_STATUS } from '../../theme/tokens';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusPillProps {
  status: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatusPill({ status }: StatusPillProps) {
  const { status: statusMap } = useTheme();
  const styles = useThemedStyles(createStyles);
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  const colors = statusMap[normalized] ?? FALLBACK_STATUS;

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
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
}
