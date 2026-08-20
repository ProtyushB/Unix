/**
 * DMS Service Layer
 *
 * Business logic for file upload orchestration.
 * Uses React Native { uri, type, name } file objects for uploads.
 */

import { getDmsApi } from '../provider/dms.provider';
import { FileApiInterface, ResourceFileDto, NativeFile } from '../api/file.api.interface';
import { DMS_API_CONFIG } from '../config/api.config';
import { extractErrorMessage } from '../../shared/http/axiosError';

export class DmsService {
  private api: FileApiInterface;

  constructor() {
    this.api = getDmsApi();
  }

  // ==================== FILE UPLOAD ====================

  async uploadMultipleFiles(
    files: NativeFile[],
    parentFolderId: number,
    options: Array<{ fileName?: string; metadata?: Record<string, unknown> }> = [],
  ): Promise<ResourceFileDto[]> {
    if (!files || files.length === 0) throw new Error('At least one file is required');
    if (!parentFolderId) throw new Error('parentFolderId is required');

    const metadataList = files.map((_, i) => {
      const opts = options[i] || {};
      return {
        parentFolder: { folderId: parentFolderId },
        ...(opts.fileName && { fileName: opts.fileName }),
        ...(opts.metadata && { metadata: opts.metadata }),
      };
    });

    try {
      const encoded = encodeURIComponent(JSON.stringify(metadataList));
      return await this.api.uploadMultipleFiles(files, encoded);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== FILE DELETION ====================

  async deleteFile(fileId: number): Promise<void> {
    if (!fileId) throw new Error('fileId is required');
    try {
      await this.api.deleteFile(fileId);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // ==================== UTILITIES ====================

  getResourceUrl(fileId: number): string {
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
