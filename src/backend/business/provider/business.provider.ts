/**
 * Business API + Service Provider
 */

import { BusinessApiImpl } from '../api/business.api.impl';
import { BusinessApiInterface } from '../api/business.api.interface';
import { BusinessService } from '../service/business.service';

// ─── API Provider ─────────────────────────────────────────────────────────────

let apiInstance: BusinessApiInterface | null = null;

export function getBusinessApi(): BusinessApiInterface {
  if (!apiInstance) {
    apiInstance = new BusinessApiImpl();
  }
  return apiInstance;
}

export function setBusinessApi(mockApi: BusinessApiInterface): void {
  apiInstance = mockApi;
}

export function resetBusinessApi(): void {
  apiInstance = null;
}

// ─── Service Provider ─────────────────────────────────────────────────────────

let serviceInstance: BusinessService | null = null;

export function getBusinessService(): BusinessService {
  if (!serviceInstance) {
    serviceInstance = new BusinessService();
  }
  return serviceInstance;
}

export function resetBusinessService(): void {
  serviceInstance = null;
}
