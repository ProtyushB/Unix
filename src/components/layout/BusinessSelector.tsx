import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { darkPalette, themes } from '../../theme/colors';

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
      <ChevronDown size={18} color={darkPalette.muted} />
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: darkPalette.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkPalette.border,
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: themes.default.text,
  },
});
