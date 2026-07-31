import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import type { AppTheme } from '../../theme/theme.types';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
}

// Transparent screen wrapper — the page gradient is rendered once at the
// OwnerTabNavigator root so every tab screen shares it. ScreenWrapper stays
// transparent so the gradient bleeds through the scroll area.

export function ScreenWrapper({
  children,
  scrollable = true,
  style,
}: ScreenWrapperProps) {
  const styles = useThemedStyles(createStyles);

  // KeyboardAvoidingView carries iOS. On Android `behavior` is undefined, which makes the component
  // render a plain View and do nothing — the code relied on `adjustResize` instead, but at
  // targetSdk 36 the app is permanently edge-to-edge and the window no longer resizes for the IME.
  // So Android gets the keyboard height as real scroll padding, which lets the covered field be
  // scrolled to. max() rather than a sum because an open keyboard already covers the nav bar.
  const keyboardHeight = useKeyboardHeight();
  const androidKeyboardPad =
    Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 24 } : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scrollable ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, style, androidKeyboardPad]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, style, androidKeyboardPad]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 24,
    },
  });
}
