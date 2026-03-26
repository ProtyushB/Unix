import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactElement;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon}
        <Text style={styles.title}>{title}</Text>
      </View>

      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.action}>{actionLabel} &gt;</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    action: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.primary,
    },
  });
}
