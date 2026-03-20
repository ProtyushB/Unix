/**
 * Folder Service Layer
 *
 * Business logic for DMS folder operations.
 */

import { getFolderApi } from '../provider/folder.provider';
import { FolderApiInterface, FolderDto, FolderFilterRequest } from '../api/folder.api.interface';
import { AxiosError } from 'axios';

export class FolderService {
  private api: FolderApiInterface;

  constructor() {
    this.api = getFolderApi();
  }

  // ==================== FOLDER CREATE ====================

  async createFolder(folderDto: FolderDto): Promise<FolderDto> {
    if (!folderDto) throw new Error('folderDto is required');
    try {
      return await this.api.createFolder(folderDto);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async createMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]> {
    if (!folderDtoList || folderDtoList.length === 0) {
      throw new Error('At least one folderDto is required');
    }
    try {
      return await this.api.createMultipleFolders(folderDtoList);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FOLDER VIEW ====================

  async viewFolder(folderId: number | null | undefined, isChildsRequired = false): Promise<FolderDto> {
    try {
      return await this.api.viewFolder(folderId, isChildsRequired);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async viewMultipleFolders(filterRequest: FolderFilterRequest): Promise<FolderDto[]> {
    if (!filterRequest) throw new Error('filterRequest is required');
    try {
      return await this.api.viewMultipleFolders(filterRequest);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FOLDER UPDATE ====================

  async updateFolder(folderDto: FolderDto): Promise<FolderDto> {
    if (!folderDto) throw new Error('folderDto is required');
    try {
      return await this.api.updateFolder(folderDto);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async updateMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]> {
    if (!folderDtoList || folderDtoList.length === 0) {
      throw new Error('At least one folderDto is required');
    }
    try {
      return await this.api.updateMultipleFolders(folderDtoList);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FOLDER DELETE ====================

  async deleteFolder(folderId: number): Promise<string> {
    if (!folderId) throw new Error('folderId is required');
    try {
      return await this.api.deleteFolder(folderId);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async deleteMultipleFolders(folderIds: number[]): Promise<string> {
    if (!folderIds || folderIds.length === 0) {
      throw new Error('At least one folderId is required');
    }
    try {
      const encoded = encodeURIComponent(JSON.stringify(folderIds));
      return await this.api.deleteMultipleFolders(encoded);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== ERROR HANDLING ====================

  private handleApiError(error: unknown): Error {
    const axiosError = error as AxiosError<string | { error?: string; message?: string }>;
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      const message = typeof data === 'string' ? data : data.error || data.message;
      if (message) return new Error(message);
    }
    if ((error as Error).message) return new Error((error as Error).message);
    return new Error('An unexpected DMS error occurred');
  }
}
