import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence for the in-app updater.
 *
 * Deliberately NOT wired into `biometricStorage.logoutClear()`. A dismissed
 * update is a device preference, not session state — logging out and back in
 * should not resurrect a prompt the user already declined, and the update
 * itself has nothing to do with who is signed in.
 */
const KEYS = {
  /** versionCode the user last tapped "Later" on. */
  DISMISSED_CODE: 'update:dismissed_version_code',
  /** Epoch ms of the last manifest fetch, successful or not. */
  LAST_CHECKED_AT: 'update:last_checked_at',
};

/**
 * How long to wait between manifest fetches.
 *
 * Purely a network guard, not the thing that stops repeat prompts — that is
 * per-version dismissal below. Six hours means a release reaches an active user
 * the same day without the app polling on every foreground.
 */
export const CHECK_THROTTLE_MS = 6 * 60 * 60 * 1000;

export const updateStorage = {
  /**
   * The versionCode the user dismissed, or 0.
   *
   * Per-version rather than a timed snooze on purpose: a snooze re-nags on a
   * release the user has already declined, while this prompts exactly once per
   * release and then goes quiet until a genuinely newer build appears.
   */
  getDismissedCode: async (): Promise<number> => {
    const raw = await AsyncStorage.getItem(KEYS.DISMISSED_CODE);
    return Number(raw ?? 0) || 0;
  },

  setDismissedCode: (versionCode: number) =>
    AsyncStorage.setItem(KEYS.DISMISSED_CODE, String(versionCode)),

  getLastCheckedAt: async (): Promise<number> => {
    const raw = await AsyncStorage.getItem(KEYS.LAST_CHECKED_AT);
    return Number(raw ?? 0) || 0;
  },

  markChecked: () => AsyncStorage.setItem(KEYS.LAST_CHECKED_AT, String(Date.now())),

  /** Used by the manual "Check for updates" button, which must never be throttled. */
  clearThrottle: () => AsyncStorage.removeItem(KEYS.LAST_CHECKED_AT),
};
