import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Toast as ToastOverlay, type ToastColors } from '../components/common/Toast';
import { useTheme } from '../hooks/useTheme';

/**
 * The one and only way to show a toast.
 *
 * Previously each screen called useToast() for its own local state and painted
 * its own <Toast> overlay. Twelve screens did the first half; only ten did the
 * second — so every toast fired by ProductDetailScreen and ServiceDetailScreen
 * ("Product created", "Failed to save", "Product deleted", validation errors) was
 * silently discarded, because those screens never rendered anything to show them.
 *
 * With one provider at the app root that whole class of bug is gone: raising a
 * toast and displaying it are no longer two things a screen has to remember to
 * wire up. A toast also now survives navigation, since it is no longer owned by
 * the screen that raised it.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface Toast {
  id: string;
  message: string;
  /** Bold line shown above the message. Optional — omit for a single-line toast. */
  title?: string;
  type: ToastType;
  duration: number;
  /** Optional trailing action button. */
  action?: ToastAction;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { palette } = useTheme();

  // The theme is read HERE, once, rather than inside the animated toast row.
  // That row is a Reanimated component with entering/exiting animations, so the
  // fewer reasons it has to re-render the better — subscribing it to the theme is
  // what tied every visible toast to every theme switch. Resolving the accents up
  // here keeps the theme dependency on a plain, non-animated component.
  const colors: ToastColors = useMemo(
    () => ({
      success: palette.success,
      // Not theme-derived: the palette has no distinct "info" tone, so this is
      // the same fixed blue the toast has always used.
      info: '#60a5fa',
      warning: palette.warning,
      error: palette.error,
    }),
    [palette.success, palette.warning, palette.error],
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options: ToastOptions = {}) => {
      const id = uuidv4();
      const duration = options.duration ?? 3500;

      setToasts(prev => [
        ...prev,
        { id, message, title: options.title, type, duration, action: options.action },
      ]);

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [],
  );

  // The provider outlives every screen, so its timers outlive them too. Without
  // this, a pending auto-dismiss would fire after teardown.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* The single overlay for the whole app. Rendered after children so it
          stacks above them without needing a zIndex race. */}
      <ToastOverlay toasts={toasts} colors={colors} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/**
 * Returns `showToast` / `dismissToast`. Deliberately does NOT expose the toast
 * list — a screen holding the array is what led to screens rendering their own
 * overlay, which is the duplication this replaced.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider> (mounted in App.tsx)');
  }
  return ctx;
}
