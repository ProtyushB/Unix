/**
 * File API Implementation
 *
 * Implements FileApiInterface using axios to call the DMS backend.
 * Uses React Native FormData with { uri, type, name } objects for uploads.
 */

import { FileApiInterface, ResourceFileDto, NativeFile } from './file.api.interface';
import { appendFiles } from './appendFiles';
import dmsApiClient from '../config/axios.instance';
import { apiError } from '../../shared/http/axiosError';

interface DmsResponseWrapper<T> {
  success: boolean;
  message: string;
  data: T;
  error: string | null;
}

/**
 * The throw carries the wrapper rather than the sentence out of it.
 *
 * `FileService.handleApiError` runs `extractErrorMessage` over whatever this raises, and that gate
 * reads `err.response.data`. A plain `Error(wrapper.error || …)` kept the text and dropped the
 * envelope, so the gate had nothing to inspect and handed the field straight back — the exact
 * arrangement `ApiError` exists to end. The field in question is the one `LocalStorageService`
 * fills with absolute storage paths.
 *
 * This branch does not fire today: DMS-Backend's controllers all build `success(true)`, and only
 * its `GlobalExceptionHandler` builds a failure, which travels on a non-2xx and therefore rejects
 * instead of reaching here. So this is a line waiting for the first DMS endpoint that reports a
 * refusal in a 200 body, not a leak now — and it is cheaper to convert it than to remember the rule
 * when that endpoint is written.
 */
function unwrap<T>(wrapper: DmsResponseWrapper<T>): T {
  if (!wrapper.success) {
    throw apiError(wrapper, 'DMS request failed');
  }
  return wrapper.data;
}

export class FileApiImpl extends FileApiInterface {
  /**
   * POST /file/create-multiple
   * Multipart form: multipartFiles[] + resourceFileDtoListString
   * Files are { uri, type, name } objects for React Native.
   */
  async uploadMultipleFiles(
    files: NativeFile[],
    encodedResourceFileDtoList: string,
    onUploadProgress?: (event: { loaded: number; total?: number }) => void,
  ): Promise<ResourceFileDto[]> {
    const formData = new FormData();
    // Platform-split — see appendFiles.ts. The two FormData implementations disagree about what a
    // file part is, and both fail silently when given the other's shape.
    await appendFiles(formData, files);
    formData.append('resourceFileDtoListString', encodedResourceFileDtoList);

    const response = await dmsApiClient.post('/file/create-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...(onUploadProgress ? { onUploadProgress } : {}),
    });
    return unwrap(response.data);
  }

  /**
   * GET /file/get-resource?fileId=N
   * Returns binary stream or 302 redirect.
   */
  async getResource(fileId: number): Promise<unknown> {
    const response = await dmsApiClient.get('/file/get-resource', { params: { fileId } });
    return response;
  }

  /**
   * GET /file/get-resource/multiple?fileIdList=URL_ENCODED_JSON
   * Returns a ZIP archive (ArrayBuffer).
   */
  async getMultipleResources(encodedFileIdList: string): Promise<ArrayBuffer> {
    const response = await dmsApiClient.get('/file/get-resource/multiple', {
      params: { fileIdList: encodedFileIdList },
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  /**
   * DELETE /file/delete?fileId=N
   */
  async deleteFile(fileId: number): Promise<boolean> {
    const response = await dmsApiClient.delete('/file/delete', { params: { fileId } });
    return unwrap(response.data);
  }
}
