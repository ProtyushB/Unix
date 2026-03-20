/**
 * EntityFolderUtils
 *
 * Generic DMS folder utilities shared across all entity types
 * (Product, Service, Order, Appointment, Bill).
 */

import { v4 as uuidv4 } from 'uuid';
import { FolderService } from '../service/folder.service';

/**
 * Creates an entity subfolder under the given parent folder.
 */
export async function createEntityFolder(options: {
  parentFolderId: number;
  folderName?: string;
}): Promise<number> {
  const folderService = new FolderService();
  const folder = await folderService.createFolder({
    folderName: options.folderName || uuidv4(),
    parentFolderId: options.parentFolderId,
  });
  return folder.folderId!;
}

/**
 * Deletes an entity's DMS folder by its folder ID.
 */
export async function deleteEntityFolder(dmsFolderId: number | undefined | null): Promise<void> {
  if (!dmsFolderId) return;
  const folderService = new FolderService();
  await folderService.deleteFolder(dmsFolderId);
}
