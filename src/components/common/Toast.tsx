import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import type { Toast as ToastItem, ToastType } from '../../hooks/useToast';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Accent colour per toast type, resolved from the theme by ToastProvider. */
export type ToastColors = Record<ToastType, string>;

interface ToastProps {
  toasts: ToastItem[];
  colors: ToastColors;
  /** Optional — toasts auto-dismiss; tap-to-dismiss is a no-op when omitted. */
  onDismiss?: (id: string) => void;
}

// Icons are fixed per type and owe nothing to the theme, so they live at module
// scope rather than being rebuilt inside the row on every render.
const ICONS: Record<ToastType, LucideIcon> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
};

// ─── Component ──────────────────────────────────────────────────────────────

// Mobile-native toast: solid opaque card (never shows the screen through it),
// rounded icon badge, bold title over the message, optional trailing action,
// and a thin progress bar that drains over the auto-dismiss duration. A top
// overlay so it reads as a system notification, not page content. No tiny ×
// (that target was sub-44px) — the whole card is tappable to dismiss.

const SOLID_BG = '#111e35';

// Built ONCE at module scope, not inline in the render body.
//
// This is the theme-change jump. ToastRow calls useTheme() for three accent
// colours, so switching theme re-renders every visible toast — and when these
// builders were constructed inline, each render handed Reanimated a brand new
// layout-animation descriptor, which re-ran the enter animation and made the
// toast spring in from the top again. Hoisting them makes the descriptor stable,
// so a re-render restyles without re-animating.
const ENTERING = SlideInUp.springify().damping(18);
const EXITING = SlideOutUp.duration(200);

export function Toast({ toasts, colors, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 10 }]} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} color={colors[toast.type]} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// Memoised, and takes its accent colour as a plain string rather than reading the
// theme itself. ToastRow is the animated component, so it must re-render as
// rarely as possible: it previously called useTheme() for three colours, which
// subscribed every live toast to theme changes and re-rendered it on every theme
// switch. Now the props are a stable object plus a string, so switching theme
// re-renders this only if the accent colour genuinely differs — and never at all
// for the two types whose colours are theme-independent.
const ToastRow = React.memo(function ToastRow({
  toast,
  color,
  onDismiss,
}: {
  toast: ToastItem;
  color: string;
  onDismiss?: (id: string) => void;
}) {
  const progress = useSharedValue(1);
  const Icon = ICONS[toast.type];

  useEffect(() => {
    progress.value = withTiming(0, { duration: toast.duration, easing: Easing.linear });
  }, [toast.duration, progress]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View
      entering={ENTERING}
      exiting={EXITING}
      style={[styles.toast, { borderColor: color + '55' }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onDismiss?.(toast.id)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        style={styles.row}
      >
        <View style={[styles.badge, { backgroundColor: color + '26' }]}>
          <Icon size={20} color={color} />
        </View>

        <View style={styles.textCol}>
          {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
          <Text style={toast.title ? styles.message : styles.messageOnly} numberOfLines={3}>
            {toast.message}
          </Text>
        </View>

        {toast.action ? (
          <TouchableOpacity
            onPress={() => {
              toast.action?.onPress();
              onDismiss?.(toast.id);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.actionBtn, { borderColor: color + '55' }]}
          >
            <Text style={[styles.actionLabel, { color }]}>{toast.action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, { backgroundColor: color }, barStyle]} />
      </View>
    </Animated.View>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    gap: 10,
  },
  toast: {
    backgroundColor: SOLID_BG,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#f1f5f9',
  },
  message: {
    fontFamily: 'Inter-Regular',
    fontSize: 12.5,
    lineHeight: 17,
    color: '#cbd5e1',
  },
  messageOnly: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13.5,
    lineHeight: 19,
    color: '#f1f5f9',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  actionLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 12.5,
  },
  progressTrack: {
    height: 3,
    width: '100%',
    backgroundColor: '#ffffff10',
  },
  progressBar: {
    height: 3,
  },
});

export default Toast;
