/**
 * Folder Service Layer
 *
 * Business logic for DMS folder operations.
 */

import { getFolderApi } from '../provider/folder.provider';
import { FolderApiInterface, FolderDto, FolderFilterRequest } from '../api/folder.api.interface';
import { DMS_APP_ROOT_FOLDER_ID } from '../config/api.config';
import { extractErrorMessage } from '../../shared/http/axiosError';

const DEFAULT_PARENT_FOLDER_ID = Number(DMS_APP_ROOT_FOLDER_ID);

export class FolderService {
  private api: FolderApiInterface;

  constructor() {
    this.api = getFolderApi();
  }

  // ==================== FOLDER CREATE ====================

  async createFolder(folderDto: FolderDto): Promise<FolderDto> {
    if (!folderDto) throw new Error('folderDto is required');
    try {
      const dto =
        folderDto.parentFolderId != null
          ? folderDto
          : { ...folderDto, parentFolderId: DEFAULT_PARENT_FOLDER_ID };
      return await this.api.createFolder(dto);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async createMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]> {
    if (!folderDtoList || folderDtoList.length === 0) {
      throw new Error('At least one folderDto is required');
    }
    try {
      const dtoList = folderDtoList.map((dto) =>
        dto.parentFolderId != null ? dto : { ...dto, parentFolderId: DEFAULT_PARENT_FOLDER_ID },
      );
      return await this.api.createMultipleFolders(dtoList);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FOLDER VIEW ====================

  async viewFolder(
    folderId: number | null | undefined,
    isChildsRequired = false,
  ): Promise<FolderDto> {
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
    // DMS is the one backend that sometimes answers with a bare string instead of the wrapper
    // ('File not found', 'Folder is not empty'). The shared extractor reads that shape too, so
    // dropping the local `typeof data === 'string'` branch does not cost those refusals their words
    // and leave axios's "Request failed with status code 404" in their place.
    return new Error(extractErrorMessage(error, 'An unexpected DMS error occurred'));
  }
}
