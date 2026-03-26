import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.banner}>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {onDismiss ? (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dismiss}
        >
          <X size={16} color={styles.iconColor.color} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.error + '26',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    message: {
      flex: 1,
      fontSize: 13,
      color: theme.palette.error + 'CC',
      lineHeight: 18,
    },
    iconColor: {
      color: theme.palette.error + 'CC',
    },
    dismiss: {
      marginLeft: 12,
      padding: 4,
    },
  });
}
