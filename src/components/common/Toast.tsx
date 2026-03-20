import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { Toast as ToastItem } from '../../hooks/useToast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

// ─── Color Map ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ToastItem['type'], { bg: string; text: string }> = {
  success: { bg: 'rgba(16, 185, 129, 0.9)', text: '#ffffff' },
  error: { bg: 'rgba(239, 68, 68, 0.9)', text: '#ffffff' },
  info: { bg: 'rgba(59, 130, 246, 0.9)', text: '#ffffff' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(toast => {
        const colors = TYPE_COLORS[toast.type];

        return (
          <Animated.View
            key={toast.id}
            entering={SlideInDown.springify().damping(18)}
            exiting={SlideOutDown.springify().damping(18)}
            style={[styles.toast, { backgroundColor: colors.bg }]}
          >
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
              {toast.message}
            </Text>
            <TouchableOpacity
              onPress={() => onDismiss(toast.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.dismiss}
            >
              <X size={16} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  dismiss: {
    marginLeft: 12,
    padding: 2,
  },
});
