/**
 * Folder API Provider
 */

import { FolderApiImpl } from '../api/folder.api.impl';
import { FolderApiInterface } from '../api/folder.api.interface';

let apiInstance: FolderApiInterface | null = null;

export function getFolderApi(): FolderApiInterface {
  if (!apiInstance) {
    apiInstance = new FolderApiImpl();
  }
  return apiInstance;
}

export function setFolderApi(mockApi: FolderApiInterface): void {
  apiInstance = mockApi;
}

export function resetFolderApi(): void {
  apiInstance = null;
}
