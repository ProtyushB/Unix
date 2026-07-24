import Config from 'react-native-config';

/**
 * Client-side mirrors of platform feature flags.
 *
 * These are NOT the source of truth — the backend owns each flag and enforces
 * it. Flipping one here only reveals UI; the endpoint still decides. Keep each
 * default matching the backend's default so the app never offers something that
 * would 403.
 */

/**
 * Walk-in account claiming (mockups 10 / 10b).
 *
 * OFF by default, matching the `claimAccount` platform flag on the web. While
 * false the entry point is hidden and the post-OTP triage skips walk-in
 * detection entirely, so signup behaves exactly as it did before claiming
 * existed.
 *
 * TODO: replace with a read of the real flag from the pre-login platform
 * endpoint once that is reachable from mobile, so this stops being a rebuild.
 */
export const CLAIM_ACCOUNT_ENABLED = false;

/**
 * DMS file id of the single global payment QR shown on the payment step.
 *
 * Served without auth (the user has no token yet at that point). 0 disables it
 * and the step renders a "not configured" placeholder rather than a broken
 * image — the codes below it still work, so a missing QR never blocks signup.
 */
export const PAYMENT_QR_FILE_ID = Number(Config.PAYMENT_QR_FILE_ID ?? 0) || 0;
