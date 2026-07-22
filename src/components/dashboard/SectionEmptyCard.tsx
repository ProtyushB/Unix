import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionEmptyCardProps {
  icon: LucideIcon;
  title: string;
  message: string;
  actionIcon: LucideIcon;
  actionLabel: string;
  onAction: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `o5yhC8`: circular muted icon, heading, copy, pill CTA.

export function SectionEmptyCard({
  icon: Icon,
  title,
  message,
  actionIcon: ActionIcon,
  actionLabel,
  onAction,
}: SectionEmptyCardProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon size={23} color={palette.muted} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        onPress={onAction}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.primary + '1F' },
          pressed && styles.ctaPressed,
        ]}
      >
        <ActionIcon size={15} color={colors.primary} />
        <Text style={[styles.ctaLabel, { color: colors.primary }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 11,
      paddingVertical: 30,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    iconWrap: {
      width: 54,
      height: 54,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.muted,
    },
    message: {
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      color: theme.palette.muted,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 999,
    },
    ctaPressed: {
      opacity: 0.7,
    },
    ctaLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
