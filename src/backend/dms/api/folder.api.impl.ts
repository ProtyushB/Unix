/**
 * Folder API Implementation
 *
 * Implements FolderApiInterface using axios to call the DMS backend.
 * DMS backend wraps all responses in ApiResponseWrapper.
 */

import { FolderApiInterface, FolderDto, FolderFilterRequest } from './folder.api.interface';
import dmsApiClient from '../config/axios.instance';

interface DmsResponseWrapper<T> {
  success: boolean;
  message: string;
  data: T;
  error: string | null;
}

function unwrap<T>(wrapper: DmsResponseWrapper<T>): T {
  if (!wrapper.success) {
    throw new Error(wrapper.error || wrapper.message || 'DMS request failed');
  }
  return wrapper.data;
}

export class FolderApiImpl extends FolderApiInterface {
  async createFolder(folderDto: FolderDto): Promise<FolderDto> {
    const response = await dmsApiClient.post('/folder/create', folderDto);
    return unwrap(response.data);
  }

  async createMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]> {
    const response = await dmsApiClient.post('/folder/create-multiple', folderDtoList);
    return unwrap(response.data);
  }

  async viewFolder(folderId: number | null | undefined, isChildsRequired = false): Promise<FolderDto> {
    const params: Record<string, unknown> = { isChildsRequired };
    if (folderId !== null && folderId !== undefined) {
      params.folderId = folderId;
    }
    const response = await dmsApiClient.get('/folder/view', { params });
    return unwrap(response.data);
  }

  async viewMultipleFolders(filterRequest: FolderFilterRequest): Promise<FolderDto[]> {
    const response = await dmsApiClient.post('/folder/view-multiple', filterRequest);
    return unwrap(response.data);
  }

  async updateFolder(folderDto: FolderDto): Promise<FolderDto> {
    const response = await dmsApiClient.put('/folder/update', folderDto);
    return unwrap(response.data);
  }

  async updateMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]> {
    const response = await dmsApiClient.put('/folder/update-multiple', folderDtoList);
    return unwrap(response.data);
  }

  async deleteFolder(folderId: number): Promise<string> {
    const response = await dmsApiClient.delete('/folder/delete', { params: { folderId } });
    return unwrap(response.data);
  }

  async deleteMultipleFolders(encodedFolderIdList: string): Promise<string> {
    const response = await dmsApiClient.delete('/folder/delete-multiple', {
      params: { folderIdListString: encodedFolderIdList },
    });
    return unwrap(response.data);
  }
}
