import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

interface ToggleChipProps {
  label: string;
  active: boolean;
  onToggle?: () => void;
  icon?: React.ComponentType<{ size: number; color: string }>;
}

/**
 * A boolean shown as a tile rather than a switch — for flags that read as claims about the product
 * ("Organic", "Cruelty-free") rather than as settings. Parlour's two are independent: a product can
 * be both, either or neither, which is why they are two tiles and not a choice.
 *
 * Edit only. In read mode the mockups drop the tiles for plain Yes/No rows, so there is no
 * read branch here — a tile that cannot be tapped still looks tappable.
 *
 * The tick/circle on the right is what makes the state legible without relying on colour: green
 * fill alone is invisible to a chunk of users and ambiguous to everyone in bright sun.
 */
export function ToggleChip({ label, active, onToggle, icon: Icon }: ToggleChipProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const tint = active ? theme.palette.success : theme.palette.muted;
  const StateIcon = active ? Check : Circle;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
    >
      {Icon ? <Icon size={16} color={tint} /> : null}
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      <StateIcon size={15} color={active ? theme.palette.success : theme.palette.divider} />
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    chip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 36,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: theme.palette.success + '1F',
      borderColor: theme.palette.success + '55',
    },
    chipIdle: {
      backgroundColor: theme.palette.surfaceElevated,
      borderColor: theme.palette.divider,
    },
    // Takes the slack so the state glyph is pinned to the right edge of the tile.
    label: { flex: 1, fontSize: 13, fontWeight: '600' },
  });
}
