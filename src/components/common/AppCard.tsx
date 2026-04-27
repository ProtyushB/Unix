import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Overrides padding/alignment on the inner content area. */
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  activeOpacity?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Dark themes: glass surface backed by expo-blur (Dimezis V3). The BlurView's
// `blurTarget` is scoped to the gradient-only BlurTargetView in the root, so
// card contents (text, emojis, stat values) are NOT captured into the blur
// snapshot — no ghost-glow halos.
// Light themes: flat solid card.

export function AppCard({
  children,
  style,
  contentStyle,
  onPress,
  activeOpacity = 0.7,
}: AppCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDark = theme.mode === 'dark';

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity } : {};

  if (!isDark) {
    return (
      <Container style={[styles.cardFlat, style]} {...containerProps}>
        {children}
      </Container>
    );
  }

  return (
    <Container style={[styles.cardGlassOuter, style]} {...containerProps}>
      <View style={[styles.cardContent, contentStyle]}>{children}</View>
    </Container>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    cardFlat: {
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider + '80',
      borderRadius: 16,
      padding: 16,
    },
    cardGlassOuter: {
      backgroundColor: 'rgba(140, 130, 220, 0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.28)',
      borderRadius: 20,
      overflow: 'hidden',
    },
    cardContent: {
      zIndex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
  });
}

export default AppCard;
