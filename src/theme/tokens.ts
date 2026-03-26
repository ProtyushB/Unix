import type { StatusColorSet, AvatarColorPair } from './theme.types';

// ─── Status Color Tokens ─────────────────────────────────────────────────────
// Keyed by SCREAMING_SNAKE_CASE to match existing StatusPill normalisation.

export const DARK_STATUS: Record<string, StatusColorSet> = {
  ACTIVE:         { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  PAID:           { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  COMPLETED:      { bg: '#10b98120', text: '#10b981', border: '#10b98140' },
  PENDING:        { bg: '#f59e0b20', text: '#f59e0b', border: '#f59e0b40' },
  SCHEDULED:      { bg: '#f59e0b20', text: '#f59e0b', border: '#f59e0b40' },
  CONFIRMED:      { bg: '#f59e0b20', text: '#f59e0b', border: '#f59e0b40' },
  CANCELLED:      { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  EXPIRED:        { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  DEPLETED:       { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  ON_HOLD:        { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  QUARANTINED:    { bg: '#64748b20', text: '#64748b', border: '#64748b40' },
  UNPAID:         { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
  PARTIALLY_PAID: { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
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
