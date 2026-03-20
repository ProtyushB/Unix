/**
 * Person API + Service Provider
 */

import { PersonApiImpl } from '../api/person.api.impl';
import { PersonApiInterface } from '../api/person.api.interface';
import { PersonService } from '../service/person.service';

// ─── API Provider ─────────────────────────────────────────────────────────────

let apiInstance: PersonApiInterface | null = null;

export function getPersonApi(): PersonApiInterface {
  if (!apiInstance) {
    apiInstance = new PersonApiImpl();
  }
  return apiInstance;
}

export function setPersonApi(mockApi: PersonApiInterface): void {
  apiInstance = mockApi;
}

export function resetPersonApi(): void {
  apiInstance = null;
}

// ─── Service Provider ─────────────────────────────────────────────────────────

let serviceInstance: PersonService | null = null;

export function getPersonService(): PersonService {
  if (!serviceInstance) {
    serviceInstance = new PersonService();
  }
  return serviceInstance;
}

export function resetPersonService(): void {
  serviceInstance = null;
}
