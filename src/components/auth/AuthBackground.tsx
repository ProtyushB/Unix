import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

// The two soft colour washes every auth screen sits on — warm top-right, cool
// bottom-left. Rendered as SVG radial gradients rather than blurred views
// because RN has no view-blur primitive (expo-blur blurs what is *behind* a
// view, which is the opposite of what this needs).
//
// Purely decorative: absolutely positioned, never interactive, and always the
// first child so everything else stacks above it.

export function AuthBackground() {
  const { colors } = useTheme();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="warm" cx="85%" cy="8%" r="55%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="cool" cx="-5%" cy="78%" r="50%">
            <Stop offset="0" stopColor="#3b82f6" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#warm)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cool)" />
      </Svg>
    </View>
  );
}

export default AuthBackground;
