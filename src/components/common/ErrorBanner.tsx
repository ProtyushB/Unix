import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
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
          <X size={16} color="#fca5a5" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: '#fca5a5',
    lineHeight: 18,
  },
  dismiss: {
    marginLeft: 12,
    padding: 4,
  },
});
