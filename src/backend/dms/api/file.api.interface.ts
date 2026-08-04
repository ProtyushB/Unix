/**
 * File API Interface
 *
 * Defines the contract for all DMS file operations.
 */

export interface ResourceFileDto {
  id?: number;
  fileName?: string;
  filePath?: string;
  contentType?: string;
  url?: string;
  encodedContent?: string;
  parentFolder?: { folderId: number };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** React Native file descriptor for FormData uploads */
export interface NativeFile {
  uri: string;
  type: string;
  name: string;
}

export abstract class FileApiInterface {
  abstract uploadMultipleFiles(
    files: NativeFile[],
    encodedResourceFileDtoList: string,
    /**
     * Optional axios upload-progress callback. Optional so no existing caller changes; without it
     * a progress bar over an image upload can only be faked, and a faked bar on a multi-second
     * operation is worse than none.
     */
    onUploadProgress?: (event: { loaded: number; total?: number }) => void,
  ): Promise<ResourceFileDto[]>;

  abstract getResource(fileId: number): Promise<unknown>;

  abstract getMultipleResources(encodedFileIdList: string): Promise<ArrayBuffer>;

  abstract deleteFile(fileId: number): Promise<boolean>;
}
