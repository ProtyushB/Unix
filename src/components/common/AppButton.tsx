import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

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
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;

  const bgStyle = isDisabled ? styles[`bg_${variant}_disabled` as keyof typeof styles] : styles[`bg_${variant}` as keyof typeof styles];
  const textColorStyle = isDisabled ? styles[`text_${variant}_disabled` as keyof typeof styles] : styles[`text_${variant}` as keyof typeof styles];
  const borderStyle = variant === 'secondary' ? styles.borderSecondary : undefined;

  const textColor = (StyleSheet.flatten(textColorStyle) as TextStyle).color as string;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[styles.base, bgStyle, borderStyle, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.text,
              textColorStyle,
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      minHeight: 50,
    },

    // Backgrounds
    bg_primary:          { backgroundColor: theme.colors.primary },
    bg_primary_disabled: { backgroundColor: theme.colors.shadow },
    bg_secondary:          { backgroundColor: theme.palette.surface },
    bg_secondary_disabled: { backgroundColor: theme.palette.surface + '80' },
    bg_ghost:          { backgroundColor: 'transparent' },
    bg_ghost_disabled: { backgroundColor: 'transparent' },
    bg_danger:          { backgroundColor: theme.palette.error },
    bg_danger_disabled: { backgroundColor: theme.palette.error + '80' },

    // Borders
    borderSecondary: { borderWidth: 1, borderColor: theme.palette.divider },

    // Text colours
    text_primary:          { color: '#ffffff' },
    text_primary_disabled: { color: '#ffffff80' },
    text_secondary:          { color: theme.palette.onBackground },
    text_secondary_disabled: { color: theme.palette.onBackground + '60' },
    text_ghost:          { color: theme.palette.onBackground },
    text_ghost_disabled: { color: theme.palette.onBackground + '40' },
    text_danger:          { color: '#ffffff' },
    text_danger_disabled: { color: '#ffffff80' },

    text: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
    },
    textWithLeftIcon:  { marginLeft: 8 },
    textWithRightIcon: { marginRight: 8 },
  });
}

export default AppButton;
