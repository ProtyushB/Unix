import { daysBetweenYmd, todayIst } from '../../../utils/dateRange';

/**
 * The two colour rules a batch row carries: how much stock is left, and how close it is to expiry.
 *
 * Both are **ported from Centrix** (`InventoryPage.jsx:81-105`) rather than invented here, because
 * the same batch must not read "healthy" on the web portal and "critical" on the phone. The numbers
 * are 20/5 and 30 days.
 *
 * ⚠️ The Pencil legend (`NPZQ5` node `TXyKc`) drew 50/15 and 90 days. That was wrong and the design
 * file has been corrected — do not "fix" this file back to match an old export of it.
 *
 * Neither rule is a reorder point. There is no min-stock field on a batch; low-stock alerting lives
 * on the Product, which aggregates across batches. These are a reading aid on one row.
 */

// ─── Remaining ───────────────────────────────────────────────────────────────

/**
 * `none` is not "zero" — it is "no bar to draw".
 *
 * A batch with nothing left renders `none`, not `critical`, which is Centrix's behaviour and is
 * deliberate rather than a bug being copied: a depleted batch already says DEPLETED in its status
 * pill, and painting the row red as well reads as an alert about stock you could still act on.
 * Red is reserved for a batch that still has something in it and is nearly out.
 */
export type RemainingState = 'healthy' | 'low' | 'critical' | 'none';

/** Percent of the purchased quantity still on hand, or null when that cannot be known. */
export function remainingPercent(
  purchased: number | null | undefined,
  remaining: number | null | undefined,
): number | null {
  if (!purchased || purchased <= 0) return null;
  const left = Number(remaining ?? 0);
  if (!Number.isFinite(left)) return null;
  return (left / purchased) * 100;
}

/**
 * Healthy above 20%, low from 5% to 20%, critical at or below 5%.
 *
 * The falsy guard is Centrix's and matters at both ends: a batch with no purchased quantity has no
 * denominator, and one with nothing remaining gets `none` (see {@link RemainingState}).
 */
export function remainingState(
  purchased: number | null | undefined,
  remaining: number | null | undefined,
): RemainingState {
  if (!purchased || !remaining) return 'none';
  const pct = remainingPercent(purchased, remaining);
  if (pct === null) return 'none';
  if (pct > 20) return 'healthy';
  if (pct > 5) return 'low';
  return 'critical';
}

/** 0–1, for the width of a progress track. Clamped, so bad data cannot overflow the bar. */
export function remainingRatio(
  purchased: number | null | undefined,
  remaining: number | null | undefined,
): number {
  const pct = remainingPercent(purchased, remaining);
  if (pct === null) return 0;
  return Math.min(1, Math.max(0, pct / 100));
}

// ─── Expiry ──────────────────────────────────────────────────────────────────

/** `expired` is drawn struck through; `near` is the ≤30-day warning; `none` means no expiry set. */
export type ExpiryState = 'expired' | 'near' | 'fresh' | 'none';

/**
 * A batch is expired **on** its printed date, not the day after.
 *
 * `expiryDate <= today` — the conservative boundary the backend enforces everywhere (deduction
 * candidates, availability sums, the nightly sweep), which buys a one-day safety margin over the
 * industry-standard "good through the printed date". Getting this off by one would let the app
 * offer stock the server refuses to deduct.
 *
 * "Today" is **IST**, not the device's day, for the same reason — see `todayIst`.
 *
 * Compared as plain `YYYY-MM-DD` strings. That is not laziness: it is the only comparison that
 * cannot pick up a timezone on the way through, which a `new Date()` round-trip can.
 */
export function expiryState(
  expiryDate: string | null | undefined,
  today: string = todayIst(),
): ExpiryState {
  if (!expiryDate) return 'none';
  const expiry = String(expiryDate).slice(0, 10);
  if (expiry <= today) return 'expired';
  return daysBetweenYmd(today, expiry) <= 30 ? 'near' : 'fresh';
}

/** Whole days until expiry. Negative once past, null when there is no expiry date. */
export function daysToExpiry(
  expiryDate: string | null | undefined,
  today: string = todayIst(),
): number | null {
  if (!expiryDate) return null;
  return daysBetweenYmd(today, String(expiryDate).slice(0, 10));
}

/**
 * The trailing "· 55d left" on a row, or null when it would say nothing useful.
 *
 * Only shown while the batch is in the near-expiry window: on a fresh batch it is noise, and on an
 * expired one the date itself already carries the message (and reads absurdly as "-12d left").
 */
export function expiryCountdownLabel(
  expiryDate: string | null | undefined,
  today: string = todayIst(),
): string | null {
  if (expiryState(expiryDate, today) !== 'near') return null;
  const days = daysToExpiry(expiryDate, today);
  if (days === null) return null;
  return days === 1 ? '1d left' : `${days}d left`;
}
