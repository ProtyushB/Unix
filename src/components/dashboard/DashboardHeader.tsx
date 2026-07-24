import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { formatLongDate } from '../../utils/formatters';
import { BusinessSwitcherChip } from './BusinessSwitcherChip';
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
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>{formatLongDate()}</Text>
      </View>

      <BusinessSwitcherChip
        businessName={businessName}
        businessType={businessType}
        onSwitchBusiness={onSwitchBusiness}
      />
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
  /**
   * When set, the action is an expand/collapse toggle: the trailing icon
   * becomes a chevron-up (expanded) / chevron-down (collapsed) instead of the
   * navigation-style chevron-right.
   */
  expanded?: boolean;
}

export function SectionHead({
  title,
  actionLabel,
  onAction,
  muted = false,
  meta,
  expanded,
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
          {expanded === undefined ? (
            <ChevronRight size={15} color={linkColor} />
          ) : expanded ? (
            <ChevronUp size={15} color={linkColor} />
          ) : (
            <ChevronDown size={15} color={linkColor} />
          )}
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
