import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import { DetailField } from './DetailField';

/**
 * A labelled two-or-three-way segmented choice, for a field whose options are few enough and
 * mutually exclusive enough that a sheet would be overkill: Product/Raw, Yes/No.
 *
 * Extracted from the identical copies in `WastageDetailBase` and `StockTransferDetailBase`, whose
 * geometry this reproduces exactly (gap 3, padding 3, radius 12, a 1px divider border, 10-radius
 * items, `softBg` fill and `primary` text on the active one).
 *
 * ⚠️ `BatchDetailBase` has a THIRD copy that is deliberately NOT migrated to this component, and
 * that is not an oversight. It differs in three ways — `gap: 6`, no border, `borderRadius: 9` on the
 * items — and, load-bearingly, its required marker is `colors.primary` at weight 700 rather than
 * `palette.error`, with a comment recording why: the batch form opens with that field already
 * required, and a red asterisk on a pristine form reads as validation that has already failed.
 * Adopting this component there would silently reverse that decision. If the two are ever
 * reconciled it should be a deliberate visual change, not a side effect of a refactor.
 *
 * RN-free logic is not possible here (this is a `.tsx`, which jest does not collect), so nothing in
 * this file decides anything: the options, the labels and the read-mode string are all supplied.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedFieldProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** False renders the read row instead of the control. Defaults to true. */
  editable?: boolean;
  /**
   * What the read row shows. Falls back to the selected option's label, which is right whenever the
   * read value and the form value are the same thing — pass this only when they differ (e.g. a
   * saved record's pool rather than the form's).
   */
  readValue?: string;
  required?: boolean;
  /** The sentence under the control — what the choice MEANS. Not an error. */
  helper?: string | null;
  error?: string | null;
}

export function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
  editable = true,
  readValue,
  required,
  helper,
  error,
}: SegmentedFieldProps<T>) {
  const styles = useThemedStyles(createStyles);

  if (!editable) {
    const selected = options.find((o) => o.value === value);
    return <DetailField label={label} value={readValue ?? selected?.label ?? ''} editable={false} />;
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.editLabel}>{label}</Text>
        {required ? <Text style={styles.required}>*</Text> : null}
      </View>
      <View style={styles.segment}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              // Carried over from the stock-transfer copy, which was the only one of the three to
              // have it: two segmented controls on one form ("Source", "Destination") announce
              // identically without the field name, so a screen reader user cannot tell which is
              // which.
              accessibilityLabel={`${label}: ${option.label}`}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = ({ colors, palette }: AppTheme) =>
  StyleSheet.create({
    field: { gap: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    required: { fontSize: 12.5, color: palette.error },
    helper: { fontSize: 11.5, color: palette.muted },
    error: { fontSize: 11.5, color: palette.error },

    segment: {
      flexDirection: 'row',
      gap: 3,
      padding: 3,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
    segmentItemActive: { backgroundColor: colors.softBg },
    segmentLabel: { fontSize: 13, fontWeight: '600', color: palette.muted },
    segmentLabelActive: { color: colors.primary },
  });
