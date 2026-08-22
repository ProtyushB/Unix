import type { StatusColorSet, AvatarColorPair } from './theme.types';

// ─── Status Color Tokens ─────────────────────────────────────────────────────
// Keyed by SCREAMING_SNAKE_CASE to match existing StatusPill normalisation.
// Two palettes — one per mode; buildTheme picks based on theme.mode.

/**
 * The five tones, shared with Centrix so a status reads the same on both apps.
 *
 * These are the shared definition now, not an approximation of one. The portal used to derive its
 * chips from per-theme CSS custom properties, so error and info drifted across its sixteen themes
 * (error alone ran #f87171 / #ff7e7e / #fda4af) while this app resolves them per MODE and could
 * only ever match one theme. Its `--status-*` tokens have since been converged onto the two
 * palettes below, one light and one dark, so a status reads identically in both apps; only the
 * portal's decorative colours still vary by theme.
 *
 * The dark error is #ff7e7e rather than the commoner #f87171 because the portal's Midnight theme
 * composites error text down to 4.11:1 against its panels at #f87171 — under WCAG AA — while
 * #ff7e7e clears the floor on all eight of its dark themes.
 *
 * `border` is the TEXT colour at full opacity, not a washed tint of the fill. Centrix draws no
 * border at all, so nothing was copied here — this app's chips are bordered and stay bordered, and
 * a border as dark as the label is what keeps a pill legible against the card it sits on rather
 * than dissolving into it.
 */
const TONE = {
  dark: {
    success: { bg: 'rgba(16, 185, 129, 0.18)', text: '#34d399', border: '#34d399' },
    info: { bg: 'rgba(59, 130, 246, 0.18)', text: '#60a5fa', border: '#60a5fa' },
    warning: { bg: 'rgba(245, 158, 11, 0.18)', text: '#fbbf24', border: '#fbbf24' },
    error: { bg: 'rgba(239, 68, 68, 0.18)', text: '#ff7e7e', border: '#ff7e7e' },
    // Centrix builds its neutral chip as `color-mix(text-muted 14%)` over the muted text itself.
    subtle: { bg: 'rgba(147, 160, 176, 0.14)', text: '#93a0b0', border: '#93a0b0' },
  },
  light: {
    success: { bg: 'rgba(16, 185, 129, 0.15)', text: '#004a30', border: '#004a30' },
    info: { bg: 'rgba(59, 130, 246, 0.12)', text: '#0035a1', border: '#0035a1' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', text: '#6c3403', border: '#6c3403' },
    error: { bg: 'rgba(239, 68, 68, 0.12)', text: '#800000', border: '#800000' },
    subtle: { bg: 'rgba(50, 61, 78, 0.14)', text: '#323d4e', border: '#323d4e' },
  },
} as const;

/**
 * Which tone each status wears.
 *
 * The statuses Centrix also draws follow Centrix, including where that overturns a reading this app
 * had chosen for itself:
 *
 *  - PENDING is neutral, not amber. Nothing has gone wrong with a booking that has simply not been
 *    confirmed yet, and amber next to a genuinely warning state made the ordinary case shout.
 *  - CONFIRMED is amber, not blue. It is the state still owed an action, which is what amber marks
 *    on the rest of both apps.
 *  - DRAFT is info, not neutral. An unfinished bill is something to go back to, not something inert.
 *  - PARTIALLY_PAID is info and UNPAID is amber, where both used to be one undifferentiated orange —
 *    the distinction that matters on a bill is "some money arrived" versus "none did", and orange
 *    said neither.
 *  - PROCESSING is new. Centrix has always drawn it blue; this app had no token for it at all, so
 *    every Processing order fell through to FALLBACK and rendered grey.
 *
 * Statuses Centrix has no opinion on keep the bucket they were already in and simply inherit the
 * new values, so the whole set stays one palette.
 */
function statusPalette(tone: (typeof TONE)['dark' | 'light']): Record<string, StatusColorSet> {
  return {
    // Success
    ACTIVE: tone.success,
    PAID: tone.success,
    COMPLETED: tone.success,
    BILLED: tone.success,
    // A finalized bill is the settled, committed document — the same "done" green as COMPLETED.
    FINALIZED: tone.success,
    APPROVED: tone.success,
    RESOLVED: tone.success,
    RECEIVED: tone.success,
    // Info
    PROCESSING: tone.info,
    READY: tone.info,
    IN_PROGRESS: tone.info,
    IN_TRANSIT: tone.info,
    RECORDED: tone.info,
    DRAFT: tone.info,
    PARTIALLY_PAID: tone.info,
    // Screens send the short form as well as PARTIALLY_PAID; both must resolve or the pill vanishes.
    PARTIAL: tone.info,
    // Warning
    CONFIRMED: tone.warning,
    PREPARING: tone.warning,
    SCHEDULED: tone.warning,
    UNPAID: tone.warning,
    // Error
    CANCELLED: tone.error,
    REJECTED: tone.error,
    FAILED: tone.error,
    EXPIRED: tone.error,
    DEPLETED: tone.error,
    OVERDUE: tone.error,
    // Neutral
    PENDING: tone.subtle,
    ON_HOLD: tone.subtle,
    QUARANTINED: tone.subtle,
    // A refund is money already returned — not a state to act on, so it reads neutral rather than
    // competing with the pill beside it.
    REFUNDED: tone.subtle,
    PARTIAL_REFUNDED: tone.subtle,
  };
}

export const DARK_STATUS: Record<string, StatusColorSet> = statusPalette(TONE.dark);

export const LIGHT_STATUS: Record<string, StatusColorSet> = statusPalette(TONE.light);

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
