// ─── Status Color Map ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  // Green
  ACTIVE: '#10b981',
  PAID: '#10b981',
  COMPLETED: '#10b981',

  // Amber
  PENDING: '#f59e0b',
  SCHEDULED: '#f59e0b',
  CONFIRMED: '#f59e0b',

  // Red
  CANCELLED: '#ef4444',
  EXPIRED: '#ef4444',
  DEPLETED: '#ef4444',

  // Slate
  ON_HOLD: '#64748b',
  QUARANTINED: '#64748b',

  // Orange
  UNPAID: '#f97316',
  PARTIALLY_PAID: '#f97316',
};

const FALLBACK_COLOR = '#64748b';

// ─── Getter ──────────────────────────────────────────────────────────────────

export function getStatusColor(status: string): string {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  return STATUS_COLORS[normalized] ?? FALLBACK_COLOR;
}

export { STATUS_COLORS };
