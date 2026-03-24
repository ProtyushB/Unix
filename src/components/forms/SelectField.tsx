import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { darkPalette, themes } from '../../theme/colors';
import { AppButton } from '../common/AppButton';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  error,
}: SelectFieldProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [tempValue, setTempValue] = useState(value);
  const snapPoints = useMemo(() => ['50%', '70%'], []);

  const selectedLabel = options.find(o => o.value === value)?.label;

  const openSheet = useCallback(() => {
    setTempValue(value);
    bottomSheetRef.current?.expand();
  }, [value]);

  const handleConfirm = useCallback(() => {
    onChange(tempValue);
    bottomSheetRef.current?.close();
  }, [tempValue, onChange]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const renderOption = useCallback(
    ({ item }: { item: SelectOption }) => {
      const isSelected = item.value === tempValue;
      return (
        <TouchableOpacity
          onPress={() => setTempValue(item.value)}
          style={[styles.optionRow, isSelected && styles.optionRowSelected]}
        >
          <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {item.label}
          </Text>
          {isSelected ? <Text style={{ fontSize: 16, color: themes.default.primary }}>✓</Text> : null}
        </TouchableOpacity>
      );
    },
    [tempValue],
  );

  const borderColor = error
    ? '#ef4444'
    : 'rgba(51, 65, 85, 0.7)';

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        onPress={openSheet}
        style={[styles.field, { borderColor }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.fieldText, !selectedLabel && styles.placeholder]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Text style={{ fontSize: 16, color: darkPalette.muted }}>▾</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{label ?? 'Select'}</Text>

          <BottomSheetScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {options.map(item => (
              <React.Fragment key={item.value}>
                {renderOption({ item })}
              </React.Fragment>
            ))}
          </BottomSheetScrollView>

          <AppButton title="Confirm" onPress={handleConfirm} style={styles.confirmBtn} />
        </View>
      </BottomSheet>
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
  sheetBg: {
    backgroundColor: darkPalette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: darkPalette.muted,
    width: 40,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkPalette.text,
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  optionText: {
    fontSize: 15,
    color: darkPalette.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: themes.default.primary,
  },
  confirmBtn: {
    marginTop: 12,
  },
});

export default SelectField;
