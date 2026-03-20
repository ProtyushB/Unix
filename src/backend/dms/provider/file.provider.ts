/**
 * File API Provider
 */

import { FileApiImpl } from '../api/file.api.impl';
import { FileApiInterface } from '../api/file.api.interface';

let apiInstance: FileApiInterface | null = null;

export function getFileApi(): FileApiInterface {
  if (!apiInstance) {
    apiInstance = new FileApiImpl();
  }
  return apiInstance;
}

export function setFileApi(mockApi: FileApiInterface): void {
  apiInstance = mockApi;
}

export function resetFileApi(): void {
  apiInstance = null;
}
