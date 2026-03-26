import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Animated TouchableOpacity ───────────────────────────────────────────────

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Types ──────────────────────────────────────────────────────────────────

interface FABProps {
  onPress: () => void;
  icon?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FAB({ onPress, icon }: FABProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
      style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }, animatedStyle]}
    >
      {icon ?? <Plus size={26} color="#ffffff" />}
    </AnimatedTouchable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 100,
    },
  });
}
