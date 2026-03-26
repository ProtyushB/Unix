import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppInput } from '../common/AppInput';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PasswordInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PasswordInput({
  label = 'Password',
  value,
  onChangeText,
  placeholder = 'Enter password',
  error,
}: PasswordInputProps) {
  const { palette } = useTheme();
  const [visible, setVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    setVisible(prev => !prev);
  }, []);

  return (
    <AppInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      error={error}
      secureTextEntry={!visible}
      rightIcon={
        <TouchableOpacity
          onPress={toggleVisibility}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 18, color: palette.muted }}>{visible ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      }
    />
  );
}

export default PasswordInput;
