import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  // The FAB is an absolute child of the screen's SafeAreaView, and Yoga positions absolute children
  // from the border edge — so the SafeAreaView's left/right padding never reaches it and `right: 20`
  // is 20px from the raw screen edge. Fine in portrait, under the cutout in landscape.
  //
  // `bottom` stays 24 with no inset added: the custom tab bar is an in-flow sibling that already
  // owns insets.bottom, so the screen never extends under the gesture bar.
  const insets = useSafeAreaInsets();

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
      style={[
        styles.fab,
        { backgroundColor: colors.primary, shadowColor: colors.primary, right: 20 + insets.right },
        animatedStyle,
      ]}
    >
      {icon ?? <Plus size={26} color="#ffffff" />}
    </AnimatedTouchable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    // `right` comes from the component — it tracks the safe-area inset.
    fab: {
      position: 'absolute',
      bottom: 24,
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
