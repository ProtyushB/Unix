import React, { useState, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { darkPalette } from '../../theme/colors';
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
  const [visible, setVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    setVisible(prev => !prev);
  }, []);

  const Icon = visible ? EyeOff : Eye;

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
          <Icon size={20} color={darkPalette.muted} />
        </TouchableOpacity>
      }
    />
  );
}
