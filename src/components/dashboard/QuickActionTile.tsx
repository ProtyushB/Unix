import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuickActionTileProps {
  icon: LucideIcon;
  label: string;
  /** Icon + chip tint. The mockup gives each action its own hue. */
  color: string;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `G8MyFt`: 40×40 tinted chip above a caption, in a bordered card.

export function QuickActionTile({ icon: Icon, label, color, onPress }: QuickActionTileProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      {/* `color + '1F'` = ~12% alpha tint of the icon hue, per the mockup. */}
      <View style={[styles.chip, { backgroundColor: color + '1F' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tile: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    tilePressed: {
      opacity: 0.7,
    },
    chip: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
      color: theme.palette.muted,
    },
  });
}
