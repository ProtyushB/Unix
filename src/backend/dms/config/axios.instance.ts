/**
 * Axios Instance for DMS Module
 *
 * DMS uses JWT auth. validateStatus accepts 302 for S3 pre-signed URL redirects.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { DMS_API_CONFIG } from './api.config';
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

const dmsApiClient = axios.create({
  baseURL: DMS_API_CONFIG.baseURL,
  timeout: DMS_API_CONFIG.timeout,
  validateStatus: (status: number) => (status >= 200 && status < 300) || status === 302,
});

// Request interceptor - Add JWT token
dmsApiClient.interceptors.request.use(
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
dmsApiClient.interceptors.response.use(
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
        return dmsApiClient(originalRequest);
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

export default dmsApiClient;
