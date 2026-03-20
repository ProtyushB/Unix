/**
 * Auth API Provider
 *
 * Binds the API interface to a concrete implementation.
 * To swap backends (e.g., mock vs real API), only this file needs to change.
 */

import { AuthApiImpl } from '../api/auth.api.impl';
import { AuthApiInterface } from '../api/auth.api.interface';
import { AuthService } from '../service/auth.service';

// ─── API Provider ─────────────────────────────────────────────────────────────

let apiInstance: AuthApiInterface | null = null;

export function getAuthApi(): AuthApiInterface {
  if (!apiInstance) {
    apiInstance = new AuthApiImpl();
  }
  return apiInstance;
}

export function setAuthApi(mockApi: AuthApiInterface): void {
  apiInstance = mockApi;
}

export function resetAuthApi(): void {
  apiInstance = null;
}

// ─── Service Provider ─────────────────────────────────────────────────────────

let serviceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!serviceInstance) {
    serviceInstance = new AuthService();
  }
  return serviceInstance;
}

export function resetAuthService(): void {
  serviceInstance = null;
}
