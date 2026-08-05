import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

interface DetailCardProps {
  title: string;
  /** Lucide icon, drawn bare in the accent colour — the mockup has no tile behind it. */
  icon?: React.ComponentType<{ size: number; color: string }>;
  /** Forms sit slightly looser than the read view: 13 between fields versus 12 between rows. */
  gap?: number;
  children: React.ReactNode;
}

/**
 * One titled section. Geometry taken from the Pencil set: 16 padding, 16 radius, surface fill over
 * a subtle border, and a 16px accent glyph beside a 14/700 title with 8 between them.
 *
 * The whole screen is a single scroll of these — no tabs, per the mockups and the web portal.
 */
export function DetailCard({ title, icon: Icon, gap = 12, children }: DetailCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    // One gap for the whole card: the mockups space the header off the first row by exactly the
    // same amount as they space the rows off each other, so the two must not drift apart.
    <View style={[styles.card, { gap }]}>
      <View style={styles.header}>
        {Icon ? <Icon size={16} color={theme.colors.primary} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.body, { gap }]}>{children}</View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.palette.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      padding: 16,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 14, fontWeight: '700', color: theme.palette.onSurface },
    body: {},
  });
}
