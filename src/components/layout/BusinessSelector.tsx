import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BusinessSelectorProps {
  selectedBusiness: string | null;
  selectedModule: string | null;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BusinessSelector({
  selectedBusiness,
  selectedModule,
  onPress,
}: BusinessSelectorProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const displayModule = selectedModule ?? 'Module';
  const displayBusiness = selectedBusiness ?? 'Select Business';
  const label = `${displayModule} / ${displayBusiness}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={18} color={palette.muted} />
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.palette.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
      gap: 8,
    },
    label: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
  });
}
