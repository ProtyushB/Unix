/**
 * DMS API Provider
 *
 * Provides the File API instance used by DmsService for upload/delete operations.
 */

import { FileApiImpl } from '../api/file.api.impl';
import { FileApiInterface } from '../api/file.api.interface';

let apiInstance: FileApiInterface | null = null;

export function getDmsApi(): FileApiInterface {
  if (!apiInstance) {
    apiInstance = new FileApiImpl();
  }
  return apiInstance;
}

export function setDmsApi(mockApi: FileApiInterface): void {
  apiInstance = mockApi;
}

export function resetDmsApi(): void {
  apiInstance = null;
}
