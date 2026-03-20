/**
 * Folder API Interface
 *
 * Defines the contract for all DMS folder operations.
 */

export interface FolderDto {
  folderId?: number;
  folderName: string;
  parentFolderId?: number;
  organizationId?: number;
  folderDtos?: FolderDto[];
  files?: unknown[];
  [key: string]: unknown;
}

export interface FolderFilterRequest {
  folderIds?: number[];
  parentFolderId?: number;
  [key: string]: unknown;
}

export abstract class FolderApiInterface {
  abstract createFolder(folderDto: FolderDto): Promise<FolderDto>;
  abstract createMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]>;
  abstract viewFolder(folderId: number | null | undefined, isChildsRequired?: boolean): Promise<FolderDto>;
  abstract viewMultipleFolders(filterRequest: FolderFilterRequest): Promise<FolderDto[]>;
  abstract updateFolder(folderDto: FolderDto): Promise<FolderDto>;
  abstract updateMultipleFolders(folderDtoList: FolderDto[]): Promise<FolderDto[]>;
  abstract deleteFolder(folderId: number): Promise<string>;
  abstract deleteMultipleFolders(encodedFolderIdList: string): Promise<string>;
}
