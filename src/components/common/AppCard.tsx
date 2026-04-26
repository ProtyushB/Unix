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
      <View pointerEvents="none" style={styles.glassEdgeTop} />
      <View pointerEvents="none" style={styles.glassEdgeLeft} />
      <View pointerEvents="none" style={styles.glassEdgeBottom} />
      <View pointerEvents="none" style={styles.glassEdgeRight} />
      <View pointerEvents="none" style={styles.cornerTopLeft} />
      <View pointerEvents="none" style={styles.cornerTopRight} />
      <View pointerEvents="none" style={styles.cornerBottomLeft} />
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
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      borderRadius: 20,
      overflow: 'hidden',
    },
    glassEdgeTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
    glassEdgeLeft: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
    glassEdgeBottom: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.50)',
    },
    glassEdgeRight: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.50)',
    },
    cornerTopLeft: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 22,
      height: 22,
      borderTopLeftRadius: 20,
      borderTopWidth: 1.5,
      borderLeftWidth: 1.5,
      borderTopColor: 'rgba(255, 255, 255, 0.95)',
      borderLeftColor: 'rgba(255, 255, 255, 0.95)',
      borderRightWidth: 0,
      borderBottomWidth: 0,
    },
    cornerTopRight: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 22,
      height: 22,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.55)',
      borderRightColor: 'rgba(255, 255, 255, 0.10)',
      borderLeftWidth: 0,
      borderBottomWidth: 0,
    },
    cornerBottomLeft: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      width: 22,
      height: 22,
      borderBottomLeftRadius: 20,
      borderBottomWidth: 1,
      borderLeftWidth: 1,
      borderLeftColor: 'rgba(255, 255, 255, 0.55)',
      borderBottomColor: 'rgba(255, 255, 255, 0.10)',
      borderRightWidth: 0,
      borderTopWidth: 0,
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
