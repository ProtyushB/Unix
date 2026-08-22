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
  /**
   * Read-mode shape, named after `DetailField`'s prop of the same name and taking the same two
   * values, because it draws the same distinction — a field that swaps from that component to this
   * one should not have to swap words for the shape it was already asking for.
   *
   * `row` — label left, chip right, on one line.
   * `block` — label stacked over the chip. For a half-width cell, where a label and a chip sharing
   *         one line would leave the chip almost nothing.
   */
  readLayout?: 'row' | 'block';
  /** The chip. Passed in so the caller's own status→tone mapping stays the only one. */
  children: React.ReactNode;
}

/**
 * A labelled row whose value is a chip, tapped to open a sheet.
 *
 * `DetailField` renders its value as text and has no right-hand slot; giving it one would land on
 * every screen that uses it for the sake of the three that need this. The geometry below is a copy
 * of `DetailField`'s two read shapes — 13pt muted label with the value right, or a 12.5pt one
 * stacked above it, each 4pt clear of the error — so a field that swaps to this one leaves the rest
 * of its card where it was.
 *
 * The chevron is the same one `PickerField` draws on the expense form: in this app it is what
 * marks a row that opens a sheet rather than one that merely reports a value. It sits beside the
 * chip in BOTH shapes, and deliberately so — the chevron's job is to say that this chip is a
 * choice, and a chevron parked on the label line instead would be saying it about the label.
 */
export function ChipPickerRow({
  label,
  accessibilityLabel,
  onPress,
  error,
  readLayout = 'row',
  children,
}: ChipPickerRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const chevron = <ChevronDown size={16} color={theme.palette.muted} />;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <View style={styles.wrap}>
        {readLayout === 'block' ? (
          <>
            <Text style={styles.blockLabel}>{label}</Text>
            <View style={styles.value}>
              {/*
                In a half-width cell the chip is the only thing here allowed to give way, and it has
                to be told so: React Native's default `flexShrink` is 0, so without this the chip
                keeps its full natural width and the chevron is pushed past the cell's right edge —
                into the gap beside the neighbouring cell, or out of the card entirely.

                Shrinking makes the chip's own label wrap inside the pill rather than truncate. That
                is the point: the two payment statuses long enough to reach this are "Partially Paid"
                and "Partially Refunded", which share their first word, so an ellipsis would cut off
                the only part that tells them apart and show the same "Partially…" for both.
              */}
              <View style={styles.chipSlot}>{children}</View>
              {chevron}
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.value}>
              {children}
              {chevron}
            </View>
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    // 4 serves both shapes: it is what `DetailField` puts between its read row and its error, and
    // also what it puts between every part of its stacked block.
    wrap: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    label: { fontSize: 13, color: theme.palette.muted },
    // 12.5 rather than the row's 13 — `DetailField` draws its stacked label a half point smaller
    // than its row one, and these cells sit alongside fields it still draws.
    blockLabel: { fontSize: 12.5, color: theme.palette.muted },
    // 8 is the gap the expense form's picker row puts between its value and its chevron.
    value: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chipSlot: { flexShrink: 1 },
    error: { fontSize: 12, color: theme.palette.error },
  });
}
