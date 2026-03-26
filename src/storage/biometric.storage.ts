import AsyncStorage from '@react-native-async-storage/async-storage';
import {AUTH_KEYS} from './auth.storage';
import {SESSION_KEYS} from './session.storage';
import {DMS_KEY} from './dms.storage';

const KEYS = {
  ENABLED: 'biometric:enabled',
  PROMPT_SEEN: 'biometric:prompt_seen',
};

export const biometricStorage = {
  isEnabled: async (): Promise<boolean> =>
    (await AsyncStorage.getItem(KEYS.ENABLED)) === 'true',

  setEnabled: (enabled: boolean) =>
    AsyncStorage.setItem(KEYS.ENABLED, enabled ? 'true' : 'false'),

  isPromptSeen: async (): Promise<boolean> =>
    (await AsyncStorage.getItem(KEYS.PROMPT_SEEN)) === 'true',

  setPromptSeen: () => AsyncStorage.setItem(KEYS.PROMPT_SEEN, 'true'),

  clearEnabled: () => AsyncStorage.removeItem(KEYS.ENABLED),

  /**
   * Smart logout clear:
   * - If biometric is enabled: keeps refreshToken + loggedInUser + biometric flags +
   *   session:activeProfile so the login screen can offer fingerprint re-auth.
   * - If biometric is NOT enabled: full clear (same as AsyncStorage.clear).
   */
  logoutClear: async (): Promise<void> => {
    const biometricEnabled =
      (await AsyncStorage.getItem(KEYS.ENABLED)) === 'true';

    // Always clear session data, DMS data, and the short-lived access token
    await AsyncStorage.multiRemove([
      AUTH_KEYS.ACCESS_TOKEN,
      AUTH_KEYS.USER,
      ...Object.values(SESSION_KEYS),
      DMS_KEY,
    ]);

    if (!biometricEnabled) {
      // Full logout — clear everything else too
      await AsyncStorage.multiRemove([
        AUTH_KEYS.REFRESH_TOKEN,
        AUTH_KEYS.LOGGED_IN_USER,
        KEYS.ENABLED,
        KEYS.PROMPT_SEEN,
        'session:activeProfile',
      ]);
    }
    // Biometric enabled: keep refreshToken, loggedInUser, biometric:*, session:activeProfile
  },
};
