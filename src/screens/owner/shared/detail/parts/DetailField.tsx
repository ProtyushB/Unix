import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';

/** Palette role for a read-mode value, e.g. tracking "On" in success. */
export type ValueTint = 'primary' | 'accent' | 'muted' | 'success' | 'warning' | 'error' | 'info';

interface DetailFieldProps {
  label: string;
  value?: string;
  editable: boolean;
  onChange?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  /** Unit names ("piece", "ml") are lower-case nouns — the keyboard should not capitalise them. */
  autoCapitalize?: TextInputProps['autoCapitalize'];
  error?: string;
  required?: boolean;
  maxLength?: number;
  /**
   * Read-mode shape.
   *
   * `row` — label left, value right on one line. What the mockups use for every short value
   *         (Base unit, Tracking, In stock, Requires an order…).
   * `block` — label stacked over the value. Used only where the value is prose that will wrap:
   *         Description, Ingredients, Storage Conditions, Safety Warning.
   */
  readLayout?: 'row' | 'block';
  tint?: ValueTint;
}

export function DetailField({
  label,
  value,
  editable,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  error,
  required,
  maxLength,
  readLayout = 'row',
  tint = 'primary',
}: DetailFieldProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (editable && onChange) {
    return (
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.editLabel}>{label}</Text>
          {required ? <Text style={styles.required}>*</Text> : null}
        </View>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputError]}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.palette.muted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  const valueColor = tintColor(theme, value ? tint : 'muted');

  /*
    `required` and `error` render here too, not only in the editable branch above.

    They used to render only there, and the effect was silent: a field that is READ-ONLY but still
    validated — a picker trigger, a status chosen from a sheet, a date set by a calendar — dropped
    its error on the floor. The user got a save that refused with nothing on screen explaining why,
    and the label never showed the asterisk that would have warned them first.

    Seven of these were live when this was found, across four screens: the bill's status, payment
    status and date; the appointment's date, time and status; the order's status. All of them
    validate, none of them could say so. It surfaced only because someone drove the consumption form
    in a browser — nothing in this repo renders, so no test could have caught it.
  */
  if (readLayout === 'block') {
    return (
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.blockLabel}>{label}</Text>
          {required ? <Text style={styles.required}>*</Text> : null}
        </View>
        <Text style={[styles.blockValue, { color: valueColor }]}>{value || '—'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <View style={styles.labelRow}>
          <Text style={styles.rowLabel}>{label}</Text>
          {required ? <Text style={styles.required}>*</Text> : null}
        </View>
        <Text style={[styles.rowValue, { color: valueColor }]} numberOfLines={2}>
          {value || '—'}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function tintColor(theme: AppTheme, tint: ValueTint): string {
  switch (tint) {
    case 'accent':
      return theme.colors.primary;
    case 'success':
      return theme.palette.success;
    case 'warning':
      return theme.palette.warning;
    case 'error':
      return theme.palette.error;
    case 'info':
      return theme.palette.info;
    case 'muted':
      return theme.palette.muted;
    default:
      return theme.palette.onSurface;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    // ── Read: one line, value right-aligned ──────────────────────────────────
    // The row keeps its own label/value line; the wrapper exists only so an error can sit UNDER it
    // rather than being squeezed into the horizontal space beside the value.
    rowWrap: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    rowLabel: { fontSize: 13, color: theme.palette.muted },
    rowValue: { flexShrink: 1, fontSize: 13, fontWeight: '500', textAlign: 'right' },

    // ── Read: stacked, for prose that wraps ──────────────────────────────────
    block: { gap: 4 },
    blockLabel: { fontSize: 12.5, color: theme.palette.muted },
    blockValue: { fontSize: 13.5, lineHeight: 19 },

    // ── Edit ─────────────────────────────────────────────────────────────────
    field: { gap: 6 },
    labelRow: { flexDirection: 'row', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    required: { fontSize: 12.5, fontWeight: '700', color: theme.palette.error },
    input: {
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
      color: theme.palette.onSurface,
      fontSize: 14,
    },
    // The mockup draws the description box at 70 tall with its own vertical padding.
    inputMultiline: { height: 70, paddingTop: 11, paddingBottom: 11 },
    inputError: { borderColor: theme.palette.error },
    error: { fontSize: 12, color: theme.palette.error },
  });
}
