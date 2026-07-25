/**
 * API Configuration for Auth Module
 *
 * Configures base URL and default settings for the authentication service.
 * The base URL comes from the build's `.env` — see `src/config/env.ts`.
 */

import { AUTH_API_URL } from '../../../config/env';

export const AUTH_BASE_URL: string = AUTH_API_URL;

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
