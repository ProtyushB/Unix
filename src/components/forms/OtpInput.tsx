import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string;
  onChangeOtp: (otp: string) => void;
  error?: boolean;
  length?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OtpInput({ value, onChangeOtp, error = false, length = 6 }: OtpInputProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Internal positional array — never re-derived from value string.
  // Re-deriving from a joined string loses gap information (e.g. '12456'
  // cannot tell if position 2 or 5 was empty).
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] ?? '')
  );

  // Only reset when parent explicitly clears value (e.g. email changed)
  useEffect(() => {
    if (value === '') {
      setDigits(Array(length).fill(''));
    }
  }, [value, length]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus();
    }
  }, [length]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      const digit = text.replace(/[^0-9]/g, '').slice(-1);
      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);
      onChangeOtp(newDigits.join(''));
      if (digit && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, length, onChangeOtp, focusInput],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      // Only move focus back if current box is already empty
      if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        onChangeOtp(newDigits.join(''));
        focusInput(index - 1);
      }
    },
    [digits, onChangeOtp, focusInput],
  );

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        return (
          <TextInput
            key={index}
            ref={ref => { inputRefs.current[index] = ref; }}
            value={digit}
            onChangeText={text => handleChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            style={[
              styles.box,
              error && styles.boxError,
              isFocused && styles.boxFocused,
              digit && !error && !isFocused && styles.boxFilled,
            ]}
            placeholderTextColor={palette.muted}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    box: {
      flex: 1,
      height: 56,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.palette.divider + '40',
      backgroundColor: theme.palette.surface + '12',
      color: theme.palette.onBackground,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
    },
    boxFocused: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.primary + '1F',
    },
    boxFilled: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '14',
    },
    boxError: {
      borderColor: theme.palette.error,
      backgroundColor: theme.palette.error + '14',
    },
  });
}

export default OtpInput;
