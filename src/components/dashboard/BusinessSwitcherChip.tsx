import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { getBusinessTypeIcon } from '../../utils/businessTypes';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BusinessSwitcherChipProps {
  businessName: string | null;
  businessType: string | null;
  onSwitchBusiness: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Compact business-switcher pill: accent logo tile + name + chevron. Used in
// the dashboard header and on the Activation Pending screen (mockup `z9uSIF`),
// so it lives on its own instead of being embedded in DashboardHeader.

export function BusinessSwitcherChip({
  businessName,
  businessType,
  onSwitchBusiness,
}: BusinessSwitcherChipProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const LogoIcon = getBusinessTypeIcon(businessType);

  return (
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
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  });
}
