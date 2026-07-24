import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

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

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    // Clear the auto-dismiss timer if it exists
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
      const toast: Toast = {
        id,
        message,
        title: options.title,
        type,
        duration,
        action: options.action,
      };

      setToasts(prev => [...prev, toast]);

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);

      timersRef.current.set(id, timer);

      return id;
    },
    [],
  );

  return { toasts, showToast, dismissToast } as const;
}
