/**
 * Axios Instance for Person Module
 *
 * JWT interceptor with async token read from AsyncStorage.
 * On 401: attempts token refresh via auth endpoint, navigates to Login on failure.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { PERSON_API_CONFIG } from './api.config';
import { AUTH_BASE_URL } from '../../auth/config/api.config';
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

const personApiClient = axios.create({
  baseURL: PERSON_API_CONFIG.BASE_URL,
  timeout: PERSON_API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token
personApiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// Response interceptor - Handle token refresh on 401
personApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const { data: refreshResponse } = await axios.post(
          `${AUTH_BASE_URL}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;

        await setAccessToken(accessToken);
        await setRefreshToken(newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return personApiClient(originalRequest);
      } catch (_refreshError) {
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

export default personApiClient;
