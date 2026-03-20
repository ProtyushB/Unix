import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { darkPalette } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
}

// ─── Formatter ──────────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function formatDisplayDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DatePicker({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
}: DatePickerProps) {
  const [show, setShow] = useState(false);

  const handleChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShow(false);
      }
      if (selectedDate) {
        onChange(selectedDate);
      }
    },
    [onChange],
  );

  const handlePress = useCallback(() => {
    setShow(true);
  }, []);

  const handleDismissIos = useCallback(() => {
    setShow(false);
  }, []);

  const borderColor = error ? '#ef4444' : 'rgba(51, 65, 85, 0.7)';

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={[styles.field, { borderColor }]}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {value ? formatDisplayDate(value) : 'Select date'}
        </Text>
        <Calendar size={18} color={darkPalette.muted} />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {show ? (
        <View>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant="dark"
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity onPress={handleDismissIos} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: darkPalette.text,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  fieldText: {
    fontSize: 16,
    color: darkPalette.text,
    flex: 1,
  },
  placeholder: {
    color: darkPalette.muted,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
});
