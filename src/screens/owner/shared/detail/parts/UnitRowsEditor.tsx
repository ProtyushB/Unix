import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import type { StockUnitLine } from '../../../../../backend/modules/shared/inventory.types';
import { showsAddUnitRow, unitRowsRollup } from '../../../inventory/batchUnits';

interface Props {
  /** The rows, owned by the caller. Already clamped — see `clampUnitRows`. */
  rows: StockUnitLine[];
  /**
   * The product's ladder, for the unit picker on each row and for the Add gate. Its LENGTH is what
   * decides whether Add can offer anything.
   */
  ladderSize: number;
  /** Base units on hand, for the roll-up. Null while no product is picked — null is NOT zero. */
  availableBaseQty: number | null;
  baseUnit: string;
  /**
   * Whether a SECOND row may exist. Default true.
   *
   * ⚠️ Stock transfer passes `false`, and it is not a style choice: the server DISCARDS `unitLines`
   * on a transfer and rebuilds the destination batch from the scalar total, so a breakdown typed
   * here would be sent, dropped, and missing from the detail screen the user lands on. The UI must
   * not promise what the round trip will lose.
   */
  allowMultiple?: boolean;
  onChangeQty: (index: number, qty: string) => void;
  /** Opens the caller's unit picker for that row. The picker itself is the caller's, not ours. */
  onPickUnit: (index: number) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}

/**
 * The quantity editor for a stock movement: one row per unit level, plus a roll-up in base units.
 *
 * "1 strip and 8 tablets" is a single quantity a person can state in one breath and cannot state in
 * one number, which is what these rows exist for. The arithmetic that turns them back into one
 * number — and the decision about which of the two payload shapes to send — lives in
 * `batchUnits.ts`, not here: `jest.config.js` collects `src/**\/*.test.ts` only, so a rule written
 * inside a `.tsx` cannot be tested at all.
 *
 * This file therefore holds JSX and nothing else. Every `?` below is a null-render of a value some
 * tested function already decided (`showsAddUnitRow`, `unitRowsRollup`).
 */
export function UnitRowsEditor({
  rows,
  ladderSize,
  availableBaseQty,
  baseUnit,
  allowMultiple = true,
  onChangeQty,
  onPickUnit,
  onAddRow,
  onRemoveRow,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const rollup = unitRowsRollup(rows, availableBaseQty, baseUnit);
  const canAdd = showsAddUnitRow({ allowMultiple, rowCount: rows.length, ladderSize });

  return (
    <View style={styles.wrap}>
      {rows.map((row, index) => (
        <View key={`${row.unit}-${index}`} style={styles.row}>
          <TextInput
            style={styles.qtyInput}
            value={String(row.qty ?? '')}
            onChangeText={(text) => onChangeQty(index, text)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.palette.muted}
            accessibilityLabel={`Quantity in ${row.unit || baseUnit}`}
          />
          <Pressable
            style={styles.unitButton}
            onPress={() => onPickUnit(index)}
            accessibilityRole="button"
            accessibilityLabel={`Change unit, currently ${row.unit || baseUnit}`}
          >
            <Text style={styles.unitLabel} numberOfLines={1}>
              {row.unit || baseUnit}
            </Text>
            <Text style={styles.unitMult}>{`×${row.perStock}`}</Text>
          </Pressable>
          {/* The first row cannot be removed — a movement with no rows has no quantity, and an
              empty editor offers nothing to type into. */}
          {index > 0 ? (
            <Pressable
              style={styles.removeButton}
              onPress={() => onRemoveRow(index)}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${row.unit || baseUnit} row`}
              hitSlop={8}
            >
              <X size={15} color={theme.palette.muted} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {canAdd ? (
        <Pressable
          style={styles.addRow}
          onPress={onAddRow}
          accessibilityRole="button"
          accessibilityLabel="Add unit"
        >
          <Plus size={14} color={theme.colors.primary} />
          <Text style={styles.addLabel}>Add unit</Text>
        </Pressable>
      ) : null}

      {rollup ? <Text style={styles.rollup}>{rollup}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    wrap: { gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qtyInput: {
      flex: 1,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      fontSize: 14,
      color: palette.onSurface,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    unitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    unitLabel: { fontSize: 13.5, fontWeight: '600', color: palette.onSurface },
    unitMult: { fontSize: 11.5, color: palette.muted },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Tinted rather than filled — a secondary affordance beside the form's solid Save button.
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: colors.softBg,
      borderColor: colors.primary + '40',
    },
    addLabel: { fontSize: 12.5, fontWeight: '600', color: colors.primary },

    rollup: { fontSize: 12, color: palette.muted },
  });
}
