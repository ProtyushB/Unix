import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// The square back affordance at the top-left of every recovery screen
// (mockups 05–09). Left-aligned in its own row so it never collides with the
// title block below it.

interface AuthTopBackProps {
  onPress: () => void;
  disabled?: boolean;
}

export function AuthTopBack({ onPress, disabled = false }: AuthTopBackProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft size={20} color={palette.onSurface} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
    },
    button: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
  });
}

export default AuthTopBack;
