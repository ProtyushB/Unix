/**
 * DMS Module - Public API
 */

export { useFile } from './hook/useFile';
export { useFolder } from './hook/useFolder';
export { useDmsImages } from './hook/useDmsImages';
export { DMS_API_CONFIG, DMS_BASE_URL, DMS_APP_ROOT_FOLDER_ID, DMS_BUSINESS_APP_ROOT_FOLDER_ID } from './config/api.config';
export { FileService } from './service/file.service';
export { FolderService } from './service/folder.service';
export { DmsService } from './service/dms.service';
export type { FolderDto, FolderFilterRequest } from './api/folder.api.interface';
export type { ResourceFileDto, NativeFile } from './api/file.api.interface';
