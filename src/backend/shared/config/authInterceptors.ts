/**
 * The single auth gate for every API client.
 *
 * Port of `Centrix/src/backend/modules/shared/config/authInterceptors.js`. Before this, the same
 * logic was hand-copied into seven axios instances in two dialects, which produced three distinct
 * defects:
 *
 *   - No coordination, so a burst of 401s fired a refresh each. With rotation only the first
 *     succeeds and the rest log the user out. See RefreshCoordinator.
 *   - parlour/pharmacy/restaurant POSTed `/auth/refresh` at their OWN base URL rather than the
 *     auth service, so it 404'd and the catch wiped the session. Those three modules had no
 *     refresh at all — they had a logout on first token expiry.
 *   - The four typed clients reset navigation to `Login`, which is not a root route (the root
 *     stack is Auth | OwnerTabs | CustomerTabs, with Login nested inside Auth), so the reset
 *     could not do anything useful.
 *
 * Anything needing an authenticated client should call `installAuthInterceptors` rather than
 * writing its own pair.
 */

import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { CommonActions } from '@react-navigation/native';
import { AUTH_BASE_URL } from '../../auth/config/api.config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAllAuth,
} from '../../../storage/auth.storage';
import { navigationRef } from '../../../navigation/RootNavigator';
import { RefreshCoordinator, shouldSkipRefresh } from '../auth/refreshCoordinator';

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Module-level, so all clients share one in-flight refresh. A per-client coordinator would leave
 * the original bug in place across modules — a dashboard screen hits person AND parlour at once.
 */
const coordinator = new RefreshCoordinator({
  getRefreshToken,
  setTokens: async ({ accessToken, refreshToken }) => {
    await setAccessToken(accessToken);
    if (refreshToken) await setRefreshToken(refreshToken);
  },
  // Bare axios on purpose: routing this through an instrumented client would let a 401 from
  // /auth/refresh recurse straight back into this coordinator.
  postRefresh: async refreshToken => {
    const { data } = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, { refreshToken });
    return data?.data ?? {};
  },
});

/** Drop any in-flight refresh. Call on logout so a queued refresh can't resurrect a dead session. */
export function resetRefreshState(): void {
  coordinator.reset();
}

async function bailToAuth(): Promise<void> {
  await clearAllAuth();
  if (navigationRef.isReady()) {
    // 'Auth', not 'Login' — see the note at the top of this file.
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }));
  }
}

/** Attach the Bearer request interceptor and the 401 → refresh → retry response interceptor. */
export function installAuthInterceptors(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  client.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetryableRequest | undefined;
      if (!originalRequest) return Promise.reject(error);

      const is401 = error.response?.status === 401;
      if (!is401 || originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const accessToken = await coordinator.refresh();
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return client(originalRequest);
      } catch (refreshError) {
        await bailToAuth();
        return Promise.reject(refreshError);
      }
    },
  );

  return client;
}
