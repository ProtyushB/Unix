import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type KeyboardTypeOptions,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { darkPalette } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppInputProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  style?: ViewStyle;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const AppInput = React.forwardRef<TextInput, AppInputProps>(function AppInput({
  label,
  value,
  defaultValue,
  onChangeText,
  placeholder,
  error,
  disabled = false,
  leftIcon,
  rightIcon,
  keyboardType,
  secureTextEntry,
  multiline = false,
  style,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  maxLength,
}, ref) {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? '#ef4444'
    : isFocused
      ? '#f97316'
      : 'rgba(51, 65, 85, 0.7)';

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputRow,
          { borderColor },
          disabled && styles.inputDisabled,
          multiline && styles.inputMultiline,
        ]}
      >
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}

        <TextInput
          ref={ref}
          {...(value !== undefined ? { value } : {})}
          defaultValue={defaultValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={darkPalette.muted}
          editable={!disabled}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          maxLength={maxLength}
          disableFullscreenUI={true}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            multiline && styles.multilineInput,
          ]}
        />

        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputMultiline: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: darkPalette.text,
    paddingVertical: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  multilineInput: {
    minHeight: 76,
    paddingTop: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
});
