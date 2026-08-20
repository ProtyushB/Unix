/**
 * File Service Layer
 *
 * Business logic for DMS file operations.
 */

import { getFileApi } from '../provider/file.provider';
import { FileApiInterface, ResourceFileDto, NativeFile } from '../api/file.api.interface';
import { DMS_API_CONFIG } from '../config/api.config';
import { extractErrorMessage } from '../../shared/http/axiosError';

export class FileService {
  private api: FileApiInterface;

  constructor() {
    this.api = getFileApi();
  }

  // ==================== FILE CREATE ====================

  async createMultipleFiles(
    files: NativeFile[],
    parentFolderId: number,
    options: Array<{ fileName?: string; metadata?: Record<string, unknown> }> = [],
    onUploadProgress?: (event: { loaded: number; total?: number }) => void,
  ): Promise<ResourceFileDto[]> {
    if (!files || files.length === 0) throw new Error('At least one file is required');

    const metadataList = files.map((_, i) => {
      const opts = options[i] || {};
      return {
        ...(parentFolderId != null && { parentFolder: { folderId: parentFolderId } }),
        ...(opts.fileName && { fileName: opts.fileName }),
        ...(opts.metadata && { metadata: opts.metadata }),
      };
    });

    try {
      const encoded = encodeURIComponent(JSON.stringify(metadataList));
      return await this.api.uploadMultipleFiles(files, encoded, onUploadProgress);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FILE FETCH ====================

  async getResource(fileId: number): Promise<unknown> {
    if (!fileId) throw new Error('fileId is required');
    try {
      return await this.api.getResource(fileId);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async getMultipleResources(fileIds: number[]): Promise<ArrayBuffer> {
    if (!fileIds || fileIds.length === 0) throw new Error('At least one fileId is required');
    try {
      const encoded = encodeURIComponent(JSON.stringify(fileIds));
      return await this.api.getMultipleResources(encoded);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FILE DELETE ====================

  async deleteFile(fileId: number): Promise<boolean> {
    if (!fileId) throw new Error('fileId is required');
    try {
      return await this.api.deleteFile(fileId);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== UTILITIES ====================

  getResourceUrl(fileId: number): string {
    // Static import, not `require`. This was the only CommonJS require left in src/: Metro tolerates
    // it, but the web preview is plain ESM where `require` is simply not defined, so the first
    // caller of this method crashed the screen. There is no import cycle to justify the lazy form —
    // api.config only reads from config/env.
    return `${DMS_API_CONFIG.baseURL}/file/get-resource?fileId=${fileId}`;
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
