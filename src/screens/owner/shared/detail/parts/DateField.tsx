import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import { parseYmd, toYmd } from '../../../../../utils/dateRange';

interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, or empty. Never an ISO instant — see the note on `toYmd` below. */
  value?: string;
  editable: boolean;
  onChange?: (ymd: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  /** `YYYY-MM-DD` bounds. The picker cannot offer a date outside them. */
  min?: string;
  max?: string;
  /** Read-mode value formatter. Defaults to the raw `YYYY-MM-DD`. */
  format?: (ymd: string) => string;
}

/**
 * A date, matching `DetailField`'s read/edit contract.
 *
 * Exists because there was no shared date part — the two screens that needed one each wired a bare
 * `DateTimePicker` at the route-component level, which cannot be reused and does not match
 * `DetailField`'s geometry.
 *
 * ⚠️ The value is a **`YYYY-MM-DD` string**, never a `Date` and never an ISO instant. Storing a
 * `Date` and calling `.toISOString()` on the way out gives the UTC day, which is the PREVIOUS day
 * for every IST user until 05:30 — an off-by-one that silently back-dates an expiry. `toYmd` reads
 * the local calendar fields instead, and `parseYmd` builds a local-midnight Date from parts rather
 * than letting `new Date('2026-08-07')` parse it as UTC.
 */
export function DateField({
  label,
  value,
  editable,
  onChange,
  placeholder = 'Pick a date',
  required,
  error,
  min,
  max,
  format,
}: DateFieldProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [picking, setPicking] = useState(false);

  const display = value ? (format ? format(value) : value) : '';

  if (!editable) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, !display && styles.rowValueEmpty]} numberOfLines={1}>
          {display || '—'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.editLabel}>{label}</Text>
        {required ? <Text style={styles.required}>*</Text> : null}
      </View>

      <Pressable
        onPress={() => setPicking(true)}
        style={[styles.input, !!error && styles.inputError]}
        accessibilityRole="button"
        accessibilityLabel={`${label}${display ? `, ${display}` : ', not set'}`}
      >
        <Text style={[styles.inputText, !display && styles.inputPlaceholder]} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <Calendar size={16} color={theme.palette.muted} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/*
        Gated on state, not on the picker's own `visible`-style prop. On Android the component IS
        the dialog and must be unmounted to dismiss; leaving it mounted re-opens it on every render.
      */}
      {picking ? (
        <DateTimePicker
          value={value ? parseYmd(value) : parseYmd(min ?? toYmd(new Date()))}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={min ? parseYmd(min) : undefined}
          maximumDate={max ? parseYmd(max) : undefined}
          onChange={(event, picked) => {
            // Android fires 'dismissed' with no date; iOS fires 'set' on every spin.
            setPicking(Platform.OS === 'ios');
            if (event.type === 'dismissed' || !picked) {
              setPicking(false);
              return;
            }
            onChange?.(toYmd(picked));
            if (Platform.OS !== 'ios') setPicking(false);
          }}
        />
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    // Mirrors DetailField's read row exactly, so a date sits flush with its neighbours.
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    rowLabel: { fontSize: 13, color: theme.palette.muted },
    rowValue: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'right',
      color: theme.palette.onSurface,
    },
    rowValueEmpty: { color: theme.palette.muted },

    field: { gap: 6 },
    labelRow: { flexDirection: 'row', gap: 3 },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    required: { fontSize: 12.5, fontWeight: '700', color: theme.palette.error },
    // Same 44/12/divider geometry as DetailField's TextInput.
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    inputError: { borderColor: theme.palette.error },
    inputText: { flex: 1, fontSize: 14, color: theme.palette.onSurface },
    inputPlaceholder: { color: theme.palette.muted },
    error: { fontSize: 12, color: theme.palette.error },
  });
}
