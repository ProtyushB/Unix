/**
 * Kept as a re-export so the twelve existing `from '../../hooks/useToast'`
 * imports keep working. The state and the single overlay live in ToastContext —
 * see the note there on why per-screen toast state was removed.
 */
export { useToast, ToastProvider } from '../context/ToastContext';
export type { Toast, ToastType, ToastAction, ToastOptions } from '../context/ToastContext';
