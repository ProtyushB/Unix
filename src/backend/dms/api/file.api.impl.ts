/**
 * File API Implementation
 *
 * Implements FileApiInterface using axios to call the DMS backend.
 * Uses React Native FormData with { uri, type, name } objects for uploads.
 */

import { FileApiInterface, ResourceFileDto, NativeFile } from './file.api.interface';
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

export class FileApiImpl extends FileApiInterface {
  /**
   * POST /file/create-multiple
   * Multipart form: multipartFiles[] + resourceFileDtoListString
   * Files are { uri, type, name } objects for React Native.
   */
  async uploadMultipleFiles(
    files: NativeFile[],
    encodedResourceFileDtoList: string,
  ): Promise<ResourceFileDto[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('multipartFiles', file as unknown as Blob);
    });
    formData.append('resourceFileDtoListString', encodedResourceFileDtoList);

    const response = await dmsApiClient.post('/file/create-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
