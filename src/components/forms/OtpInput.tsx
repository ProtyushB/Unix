import React, { useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { darkPalette, themes } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  error?: boolean;
  length?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OtpInput({ value, onChange, error = false, length = 6 }: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const digits = value.padEnd(length, '').split('').slice(0, length);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus();
    }
  }, [length]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      // Only accept single digit
      const digit = text.replace(/[^0-9]/g, '').slice(-1);
      const newDigits = [...digits];
      newDigits[index] = digit;
      const newValue = newDigits.join('');
      onChange(newValue);

      // Auto-advance to next input on digit entry
      if (digit && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, length, onChange, focusInput],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
        // Clear previous and move focus back
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        focusInput(index - 1);
      }
    },
    [digits, onChange, focusInput],
  );

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => {
        const isFocused = false; // managed by TextInput internally
        return (
          <TextInput
            key={index}
            ref={ref => {
              inputRefs.current[index] = ref;
            }}
            value={digit}
            onChangeText={text => handleChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            onFocus={() => {}}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            style={[
              styles.box,
              error && styles.boxError,
              digit ? styles.boxFilled : undefined,
            ]}
            placeholderTextColor={darkPalette.muted}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: darkPalette.border,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: darkPalette.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  boxFilled: {
    borderColor: themes.default.primary,
  },
  boxError: {
    borderColor: '#ef4444',
  },
});
