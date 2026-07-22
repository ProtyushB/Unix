import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LiveDataBannerProps {
  message?: string;
  onRetry: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `S3M25q`: inline error strip under the header, with a Retry chip.
// Distinct from the full-width `ErrorBanner` in components/common — this one
// sits inside the scroll content and keeps the rest of the page interactive.

export function LiveDataBanner({
  message = 'Live data unavailable right now',
  onRetry,
}: LiveDataBannerProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.banner}>
      <WifiOff size={16} color={palette.error} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>

      <Pressable
        onPress={onRetry}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <RefreshCw size={11} color={palette.error} />
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.palette.error + '22',
      borderWidth: 1,
      borderColor: theme.palette.error + '33',
    },
    text: {
      flex: 1,
      fontSize: 12,
      fontWeight: '500',
      color: theme.palette.error,
    },
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: theme.palette.error + '22',
    },
    retryPressed: {
      opacity: 0.7,
    },
    retryText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.palette.error,
    },
  });
}
