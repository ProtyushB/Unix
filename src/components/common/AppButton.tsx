import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ─── Variant Configs ────────────────────────────────────────────────────────

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: '#f97316',
  secondary: '#334155',
  ghost: 'transparent',
  danger: '#ef4444',
};

const VARIANT_BG_DISABLED: Record<ButtonVariant, string> = {
  primary: '#f9731650',
  secondary: '#33415550',
  ghost: 'transparent',
  danger: '#ef444450',
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: '#ffffff',
  secondary: '#f8fafc',
  ghost: '#f8fafc',
  danger: '#ffffff',
};

const VARIANT_TEXT_DISABLED: Record<ButtonVariant, string> = {
  primary: '#ffffff80',
  secondary: '#f8fafc60',
  ghost: '#f8fafc40',
  danger: '#ffffff80',
};

const VARIANT_BORDER: Record<ButtonVariant, string | undefined> = {
  primary: undefined,
  secondary: '#475569',
  ghost: undefined,
  danger: undefined,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const bg = isDisabled ? VARIANT_BG_DISABLED[variant] : VARIANT_BG[variant];
  const textColor = isDisabled ? VARIANT_TEXT_DISABLED[variant] : VARIANT_TEXT[variant];
  const borderColor = VARIANT_BORDER[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        { backgroundColor: bg },
        borderColor ? { borderWidth: 1, borderColor } : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.text,
              { color: textColor },
              leftIcon ? styles.textWithLeftIcon : undefined,
              rightIcon ? styles.textWithRightIcon : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 50,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  textWithLeftIcon: {
    marginLeft: 8,
  },
  textWithRightIcon: {
    marginRight: 8,
  },
});

export default AppButton;
