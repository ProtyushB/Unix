import Config from 'react-native-config';

/**
 * Environment-driven backend configuration.
 *
 * Every backend URL the app talks to resolves here, from the `.env` that
 * `react-native-config` bakes in at build time (wired via `dotenv.gradle`).
 * That is what makes one codebase produce a dev APK and a live APK: the branch
 * supplies the `.env`, nothing in source names an environment.
 *
 * Do NOT reintroduce hardcoded hosts in the per-module `api.config.ts` files.
 * They used to hold literal production URLs, which meant every build — however
 * it was configured — talked to production.
 */

/**
 * Local-dev fallbacks, matching `.env.example`.
 *
 * Deliberately localhost and NOT production: a build with a missing or
 * unreadable `.env` is misconfigured, and pointing it at localhost makes that
 * fail immediately and visibly. Defaulting to production would silently
 * recreate the very bug this module exists to prevent — a "dev" build quietly
 * reading and writing live data.
 */
const LOCAL_DEFAULTS: Record<string, string> = {
  AUTH_API_URL: 'http://localhost:8085',
  PERSON_API_URL: 'http://localhost:8086',
  PARLOUR_API_URL: 'http://localhost:8086',
  PHARMACY_API_URL: 'http://localhost:8086',
  RESTAURANT_API_URL: 'http://localhost:8086',
  DMS_API_URL: 'http://localhost:8087',
};

/**
 * Reads a base URL from the baked-in config, trimming any trailing slash so
 * callers can concatenate paths (`${BASE}/auth/refresh`) without doubling up.
 */
function readBaseUrl(name: keyof typeof LOCAL_DEFAULTS): string {
  const value = Config[name];
  if (!value) {
    console.warn(
      `[env] ${name} is not set — falling back to ${LOCAL_DEFAULTS[name]}. ` +
        'This build is missing its .env and will not reach a real backend.',
    );
    return LOCAL_DEFAULTS[name];
  }
  return value.replace(/\/+$/, '');
}

export const AUTH_API_URL = readBaseUrl('AUTH_API_URL');
export const PERSON_API_URL = readBaseUrl('PERSON_API_URL');
export const PARLOUR_API_URL = readBaseUrl('PARLOUR_API_URL');
export const PHARMACY_API_URL = readBaseUrl('PHARMACY_API_URL');
export const RESTAURANT_API_URL = readBaseUrl('RESTAURANT_API_URL');
export const DMS_API_URL = readBaseUrl('DMS_API_URL');

/**
 * DMS folder ids the app provisions under.
 *
 * Environment-specific: each DMS instance seeds its own folder tree, so dev and
 * live will not agree on these numbers. Kept as strings to match the ids
 * returned by the DMS API; callers coerce where they need a number.
 */
export const DMS_APP_ROOT_FOLDER_ID = Config.DMS_APP_ROOT_FOLDER_ID ?? '1';
export const DMS_BUSINESS_APP_ROOT_FOLDER_ID =
  Config.DMS_BUSINESS_APP_ROOT_FOLDER_ID ?? '2';
