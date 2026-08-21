/**
 * Folder API Implementation
 *
 * Implements FolderApiInterface using axios to call the DMS backend.
 * DMS backend wraps all responses in ApiResponseWrapper.
 */

import { FolderApiInterface, FolderDto, FolderFilterRequest } from './folder.api.interface';
import dmsApiClient from '../config/axios.instance';
import { apiError } from '../../shared/http/axiosError';

interface DmsResponseWrapper<T> {
  success: boolean;
  message: string;
  data: T;
  error: string | null;
}

/**
 * The throw carries the wrapper rather than the sentence out of it — see the twin in
 * `file.api.impl.ts` for the full reasoning.
 *
 * In short: `FolderService.handleApiError` and `DmsService.handleApiError` both run
 * `extractErrorMessage` over what this raises, and that gate reads `err.response.data`. A plain
 * `Error(wrapper.error || …)` left it nothing to inspect. Latent today — DMS-Backend answers every
 * failure on a non-2xx, so this branch is not reached — and one DMS change away from live.
 */
function unwrap<T>(wrapper: DmsResponseWrapper<T>): T {
  if (!wrapper.success) {
    throw apiError(wrapper, 'DMS request failed');
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

  async viewFolder(
    folderId: number | null | undefined,
    isChildsRequired = false,
  ): Promise<FolderDto> {
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
