import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

interface ChipPickerRowProps {
  label: string;
  /**
   * Spoken in place of the row's contents. The chip is a `<View>` of styled text, so a screen
   * reader landing on the Pressable would otherwise announce the button with no name at all.
   */
  accessibilityLabel: string;
  onPress?: () => void;
  error?: string;
  /** The chip. Passed in so the caller's own status→tone mapping stays the only one. */
  children: React.ReactNode;
}

/**
 * A labelled row whose value is a chip, tapped to open a sheet.
 *
 * `DetailField` renders its value as text and has no right-hand slot; giving it one would land on
 * every screen that uses it for the sake of the two that need this. The geometry below is a copy
 * of `DetailField`'s read row — 13pt muted label, value right, 4pt gap down to the error — so a
 * row that swaps to this one leaves the rest of its card where it was.
 *
 * The chevron is the same one `PickerField` draws on the expense form: in this app it is what
 * marks a row that opens a sheet rather than one that merely reports a value.
 */
export function ChipPickerRow({
  label,
  accessibilityLabel,
  onPress,
  error,
  children,
}: ChipPickerRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <View style={styles.wrap}>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.value}>
            {children}
            <ChevronDown size={16} color={theme.palette.muted} />
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    label: { fontSize: 13, color: theme.palette.muted },
    // 8 is the gap the expense form's picker row puts between its value and its chevron.
    value: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    error: { fontSize: 12, color: theme.palette.error },
  });
}
