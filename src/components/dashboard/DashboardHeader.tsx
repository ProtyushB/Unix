import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { getBusinessTypeIcon } from '../../utils/businessTypes';
import { formatLongDate } from '../../utils/formatters';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  businessName: string | null;
  businessType: string | null;
  onSwitchBusiness: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `isXIP`: title + long-date subtitle on the left, business
// switcher chip (accent logo tile + name + chevron) on the right.

export function DashboardHeader({
  businessName,
  businessType,
  onSwitchBusiness,
}: DashboardHeaderProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const LogoIcon = getBusinessTypeIcon(businessType);

  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>{formatLongDate()}</Text>
      </View>

      <Pressable
        onPress={onSwitchBusiness}
        android_ripple={{ color: palette.divider }}
        style={({ pressed }) => [styles.switcher, pressed && styles.switcherPressed]}
      >
        <View style={styles.logo}>
          <LogoIcon size={13} color={colors.onAccent} />
        </View>
        <Text style={styles.switcherName} numberOfLines={1}>
          {businessName || 'Select Business'}
        </Text>
        <ChevronDown size={16} color={palette.muted} />
      </Pressable>
    </View>
  );
}

// ─── Section Head ───────────────────────────────────────────────────────────
// Mockup node `OoH01`: section title + "See all ›". `muted` renders the link
// inert-looking for the empty state, where there is nothing to see.

interface SectionHeadProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  muted?: boolean;
  /** Right-aligned plain text instead of a link — used for "Last synced …". */
  meta?: string;
}

export function SectionHead({
  title,
  actionLabel,
  onAction,
  muted = false,
  meta,
}: SectionHeadProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const linkColor = muted ? palette.muted : colors.primary;

  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}

      {actionLabel && !meta ? (
        <Pressable
          onPress={muted ? undefined : onAction}
          disabled={muted}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.seeAll}
        >
          <Text style={[styles.seeAllText, { color: linkColor }]}>{actionLabel}</Text>
          <ChevronRight size={15} color={linkColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleBlock: {
      flexShrink: 1,
      gap: 5,
    },
    title: {
      fontSize: 27,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    subtitle: {
      fontSize: 13,
      color: theme.palette.muted,
    },
    switcher: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      maxWidth: 180,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    switcherPressed: {
      opacity: 0.7,
    },
    logo: {
      width: 24,
      height: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    switcherName: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitle: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '600',
      color: theme.palette.onBackground,
    },
    sectionMeta: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    seeAllText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
