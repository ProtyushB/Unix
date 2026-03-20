import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
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
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = uuidv4();
      const toast: Toast = { id, message, type, duration };

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
