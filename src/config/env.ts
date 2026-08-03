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
 *
 * These apply to DEV BUILDS ONLY. A release build with no config throws — see
 * `readBaseUrl`. Falling back to localhost in a release APK is never right: no
 * phone is running the backends, so the app simply fails at every call with no
 * indication why. That is not hypothetical — it shipped. R8 stripped the
 * BuildConfig class that `react-native-config` reads reflectively, this module
 * quietly substituted localhost, and every release APK from 6b86641 onward
 * talked to nothing while looking completely healthy.
 */
const LOCAL_DEFAULTS: Record<string, string> = {
  AUTH_API_URL: 'http://localhost:8085',
  PERSON_API_URL: 'http://localhost:8086',
  PARLOUR_API_URL: 'http://localhost:8086',
  PHARMACY_API_URL: 'http://localhost:8086',
  DMS_API_URL: 'http://localhost:8087',
};

/**
 * Reads a base URL from the baked-in config, trimming any trailing slash so
 * callers can concatenate paths (`${BASE}/auth/refresh`) without doubling up.
 */
function readBaseUrl(name: keyof typeof LOCAL_DEFAULTS): string {
  const value = Config[name];
  if (!value) {
    // `__DEV__` is undefined only outside React Native's bundler and the web
    // preview (which defines it as true), so treating that as a release build
    // is the strict reading — an unknown environment fails loudly rather than
    // inheriting the localhost fallback by accident.
    const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

    if (!isDevBuild) {
      throw new Error(
        `[env] ${name} is missing from a RELEASE build. The APK has no backend to ` +
          'talk to and must not start.\n\n' +
          'Two causes, both silent:\n' +
          '  1. R8 stripped com.unixtemp.BuildConfig — react-native-config reads it by ' +
          'reflection, so it needs the -keep rule in android/app/proguard-rules.pro.\n' +
          '  2. The build ran without a .env staged (Jenkins copies it per branch).\n\n' +
          'The Verify Baked URLs stage in the Jenkinsfile is meant to catch both before ' +
          'publish; if you are seeing this on a device, that stage was skipped or removed.',
      );
    }

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
export const DMS_API_URL = readBaseUrl('DMS_API_URL');

/**
 * DMS folder ids the app provisions under.
 *
 * Environment-specific: each DMS instance seeds its own folder tree, so dev and
 * live will not agree on these numbers. Kept as strings to match the ids
 * returned by the DMS API; callers coerce where they need a number.
 */
export const DMS_APP_ROOT_FOLDER_ID = Config.DMS_APP_ROOT_FOLDER_ID ?? '1';
export const DMS_BUSINESS_APP_ROOT_FOLDER_ID = Config.DMS_BUSINESS_APP_ROOT_FOLDER_ID ?? '2';
