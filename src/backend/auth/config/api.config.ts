/**
 * API Configuration for Auth Module
 *
 * Configures base URL and default settings for the authentication service.
 * Uses react-native-config for environment variables.
 */

import Config from 'react-native-config';

export const AUTH_BASE_URL: string = Config.AUTH_API_URL || 'http://localhost:8085';

export const AUTH_API_CONFIG = {
  baseURL: AUTH_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export const OTP_CONFIG = {
  expiryMinutes: 10,
  resendCooldownSeconds: 60,
};
