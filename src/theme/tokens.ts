import type { StatusColorSet, AvatarColorPair } from './theme.types';

// ─── Status Color Tokens ─────────────────────────────────────────────────────
// Keyed by SCREAMING_SNAKE_CASE to match existing StatusPill normalisation.
// Two palettes — one per mode; buildTheme picks based on theme.mode.

export const DARK_STATUS: Record<string, StatusColorSet> = {
  // Success — green
  ACTIVE: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  PAID: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  COMPLETED: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  BILLED: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  // A finalized bill is the settled, committed document — the same "done" green as COMPLETED.
  FINALIZED: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  APPROVED: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  RESOLVED: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  RECEIVED: { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  // Info — blue
  CONFIRMED: { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
  READY: { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
  IN_PROGRESS: { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
  IN_TRANSIT: { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
  RECORDED: { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
  // Warning — amber
  PENDING: { bg: '#f59e0b20', text: '#f59e0b', border: '#f59e0b40' },
  PREPARING: { bg: '#f59e0b20', text: '#f59e0b', border: '#f59e0b40' },
  SCHEDULED: { bg: '#f59e0b20', text: '#f59e0b', border: '#f59e0b40' },
  // Error — red
  CANCELLED: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  REJECTED: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  FAILED: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  EXPIRED: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  DEPLETED: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  OVERDUE: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  // Neutral — slate
  ON_HOLD: { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  QUARANTINED: { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  // A draft is not yet a document and a refund is money already returned — neither is a state to
  // act on, so both read as neutral rather than competing with the pill beside them.
  DRAFT: { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  REFUNDED: { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  PARTIAL_REFUNDED: { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  // Orange
  UNPAID: { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
  PARTIALLY_PAID: { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
  // Screens send the short form as well as PARTIALLY_PAID; both must resolve or the pill vanishes.
  PARTIAL: { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
};

export const LIGHT_STATUS: Record<string, StatusColorSet> = {
  // Success — green
  ACTIVE: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  PAID: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  COMPLETED: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  BILLED: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  FINALIZED: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  APPROVED: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  RESOLVED: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  RECEIVED: { bg: '#10b98119', text: '#047857', border: '#10b98133' },
  // Info — blue
  CONFIRMED: { bg: '#3b82f614', text: '#1e40af', border: '#3b82f633' },
  READY: { bg: '#3b82f614', text: '#1e40af', border: '#3b82f633' },
  IN_PROGRESS: { bg: '#3b82f614', text: '#1e40af', border: '#3b82f633' },
  IN_TRANSIT: { bg: '#3b82f614', text: '#1e40af', border: '#3b82f633' },
  RECORDED: { bg: '#3b82f614', text: '#1e40af', border: '#3b82f633' },
  // Warning — amber
  PENDING: { bg: '#f59e0b1a', text: '#b45309', border: '#f59e0b33' },
  PREPARING: { bg: '#f59e0b1a', text: '#b45309', border: '#f59e0b33' },
  SCHEDULED: { bg: '#f59e0b1a', text: '#b45309', border: '#f59e0b33' },
  // Error — red
  CANCELLED: { bg: '#ef444414', text: '#b91c1c', border: '#ef444433' },
  REJECTED: { bg: '#ef444414', text: '#b91c1c', border: '#ef444433' },
  FAILED: { bg: '#ef444414', text: '#b91c1c', border: '#ef444433' },
  EXPIRED: { bg: '#ef444414', text: '#b91c1c', border: '#ef444433' },
  DEPLETED: { bg: '#ef444414', text: '#b91c1c', border: '#ef444433' },
  OVERDUE: { bg: '#ef444414', text: '#b91c1c', border: '#ef444433' },
  // Neutral — slate
  ON_HOLD: { bg: '#64748b14', text: '#334155', border: '#64748b33' },
  QUARANTINED: { bg: '#64748b14', text: '#334155', border: '#64748b33' },
  DRAFT: { bg: '#64748b14', text: '#334155', border: '#64748b33' },
  REFUNDED: { bg: '#64748b14', text: '#334155', border: '#64748b33' },
  PARTIAL_REFUNDED: { bg: '#64748b14', text: '#334155', border: '#64748b33' },
  // Orange
  UNPAID: { bg: '#f9731614', text: '#c2410c', border: '#f9731633' },
  PARTIALLY_PAID: { bg: '#f9731614', text: '#c2410c', border: '#f9731633' },
  // Screens send the short form as well as PARTIALLY_PAID; both must resolve or the pill vanishes.
  PARTIAL: { bg: '#f9731614', text: '#c2410c', border: '#f9731633' },
};

export const FALLBACK_STATUS: StatusColorSet = {
  bg: '#64748b20',
  text: '#64748b',
  border: '#64748b40',
};

// ─── Avatar Color Pools ──────────────────────────────────────────────────────
// Same 8 colours as the old AvatarBadge — same order preserves existing assignments.

export const AVATAR_POOLS: AvatarColorPair[] = [
  { bg: '#f97316', text: '#ffffff' },
  { bg: '#0ea5e9', text: '#ffffff' },
  { bg: '#10b981', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#e11d48', text: '#ffffff' },
  { bg: '#f59e0b', text: '#111827' },
  { bg: '#14b8a6', text: '#ffffff' },
  { bg: '#6366f1', text: '#ffffff' },
];
