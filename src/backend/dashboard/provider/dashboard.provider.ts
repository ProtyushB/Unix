/**
 * Dashboard API + Service Provider
 */

import { DashboardApiImpl } from '../api/dashboard.api.impl';
import { DashboardApiInterface } from '../api/dashboard.api.interface';
import { DashboardService } from '../service/dashboard.service';

// ─── API Provider ─────────────────────────────────────────────────────────────

let apiInstance: DashboardApiInterface | null = null;

export function getDashboardApi(): DashboardApiInterface {
  if (!apiInstance) {
    apiInstance = new DashboardApiImpl();
  }
  return apiInstance;
}

export function setDashboardApi(mockApi: DashboardApiInterface): void {
  apiInstance = mockApi;
}

export function resetDashboardApi(): void {
  apiInstance = null;
}

// ─── Service Provider ─────────────────────────────────────────────────────────

let serviceInstance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (!serviceInstance) {
    serviceInstance = new DashboardService();
  }
  return serviceInstance;
}

export function resetDashboardService(): void {
  serviceInstance = null;
}
