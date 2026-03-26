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
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScreenWrapper({
  children,
  scrollable = true,
  style,
}: ScreenWrapperProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {scrollable ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, style]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.palette.background,
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
