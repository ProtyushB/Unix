/**
 * BusinessFolderUtils
 *
 * Creates business DMS folder structure: branch folder + 5 category subfolders.
 * Uses uuid (with react-native-get-random-values imported at app entry) instead of crypto.randomUUID().
 */

import { v4 as uuidv4 } from 'uuid';
import { FolderService } from '../service/folder.service';

const ROLE_FOLDERS = ['Business', 'Customer', 'Employee'];

const BUSINESS_CATEGORIES = ['Products', 'Services', 'Appointments', 'Orders', 'Bills'];

const CATEGORY_SLOT_MAP: Record<string, string> = {
  Products: 'productsFolderId',
  Services: 'servicesFolderId',
  Appointments: 'appointmentsFolderId',
  Orders: 'ordersFolderId',
  Bills: 'billsFolderId',
};

export interface BusinessFolderResult {
  folderId: number;
  productsFolderId: number;
  servicesFolderId: number;
  ordersFolderId: number;
  appointmentsFolderId: number;
  billsFolderId: number;
}

/**
 * Creates the 3 role folders (Business, Customer, Employee) under the user root folder.
 */
export async function createRoleFolders(
  userRootFolderId: number,
): Promise<{ Business: number; Customer: number; Employee: number }> {
  const folderService = new FolderService();
  const folders = await folderService.createMultipleFolders(
    ROLE_FOLDERS.map((name) => ({ folderName: name, parentFolderId: userRootFolderId })),
  );
  const result: Record<string, number> = {};
  folders.forEach((f) => {
    result[f.folderName] = f.folderId!;
  });
  return result as { Business: number; Customer: number; Employee: number };
}

/**
 * Creates a branch folder + 5 category subfolders under the Business role folder.
 */
export async function createBusinessDmsFolders(
  bizId: string | number,
  branchName: string | undefined,
  businessRoleFolderId: number,
): Promise<BusinessFolderResult> {
  const folderService = new FolderService();
  const id = bizId != null ? String(bizId) : null;
  const folderName = `${branchName || id}_${uuidv4()}`;

  const createDto: Record<string, unknown> = {
    folderName,
    parentFolderId: businessRoleFolderId,
  };
  if (id != null) createDto.organizationId = Number(id);

  const bizFolder = await folderService.createFolder(createDto as any);

  const subFolders = await folderService.createMultipleFolders(
    BUSINESS_CATEGORIES.map((name) => ({
      folderName: name,
      parentFolderId: bizFolder.folderId!,
    })),
  );

  const sfMap: Record<string, number> = {};
  subFolders.forEach((sf) => {
    sfMap[sf.folderName] = sf.folderId!;
  });

  return {
    folderId: bizFolder.folderId!,
    ...Object.fromEntries(
      BUSINESS_CATEGORIES.map((name) => [CATEGORY_SLOT_MAP[name], sfMap[name]]),
    ),
  } as BusinessFolderResult;
}

export { ROLE_FOLDERS, BUSINESS_CATEGORIES, CATEGORY_SLOT_MAP };
