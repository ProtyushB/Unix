/**
 * Axios Instance for Auth Module
 *
 * Configured with interceptors for:
 * - Automatic JWT token injection (async from AsyncStorage)
 * - Automatic token refresh on 401 errors
 * - Navigation to Login on refresh failure via navigationRef
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AUTH_API_CONFIG } from './api.config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAllAuth,
} from '../../../storage/auth.storage';
import { navigationRef } from '../../../navigation/RootNavigator';

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const authApiClient = axios.create({
  baseURL: AUTH_API_CONFIG.baseURL,
  timeout: AUTH_API_CONFIG.timeout,
  headers: AUTH_API_CONFIG.headers,
});

// Request interceptor - Add JWT token to requests (async)
authApiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// Response interceptor - Handle token refresh
authApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // If 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const { data } = await axios.post(
          `${AUTH_API_CONFIG.baseURL}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = data.data;

        await setAccessToken(accessToken);
        await setRefreshToken(newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return authApiClient(originalRequest);
      } catch (_refreshError) {
        // Refresh failed - logout user
        await clearAllAuth();

        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' as never }],
          });
        }

        return Promise.reject(_refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default authApiClient;
