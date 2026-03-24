/**
 * ensureBusinessDmsFolders
 *
 * Ensures the DMS folder structure for a business exists in AsyncStorage.
 * Repairs missing subfolders, deduplicates concurrent calls via Map.
 *
 * Ported from web: localStorage → AsyncStorage (getDmsFolderMap/setDmsFolderMap).
 */

import { FolderService } from '../service/folder.service';
import {
  createBusinessDmsFolders,
  createRoleFolders,
  ROLE_FOLDERS,
  CATEGORY_SLOT_MAP,
  BusinessFolderResult,
} from './BusinessFolderUtils';
import {
  getDmsFolderMap,
  setDmsFolderMap,
  DmsFolderMap,
  BusinessFolders,
} from '../../../storage/dms.storage';

// Deduplicates concurrent calls
const _inProgress = new Map<string, Promise<unknown>>();
const _ROLE_KEY = '__roleFolders__';

const SUBFOLDERS = Object.keys(CATEGORY_SLOT_MAP);

/**
 * Ensures the DMS folder structure for a business exists and is complete.
 * Also ensures role folders exist — creates them if missing.
 */
export async function ensureBusinessDmsFolders(
  bizId: string | number,
  bizName?: string,
): Promise<BusinessFolders> {
  const id = String(bizId);

  if (_inProgress.has(id)) {
    return _inProgress.get(id) as Promise<BusinessFolders>;
  }

  const folderMap = (await getDmsFolderMap()) || ({} as DmsFolderMap);
  const existing = folderMap.businesses?.[Number(id)];

  if (isComplete(existing)) return existing;

  const promise = _doRepair(id, bizName, folderMap).finally(() => _inProgress.delete(id));
  _inProgress.set(id, promise);
  return promise;
}

async function _doRepair(
  id: string,
  bizName: string | undefined,
  folderMap: DmsFolderMap,
): Promise<BusinessFolders> {
  // Step 0: Ensure role folders exist
  const roleFolders = await _ensureRoleFolders(folderMap);

  const folderService = new FolderService();
  const entry: Partial<BusinessFolders> & Record<string, unknown> = {
    ...(folderMap.businesses?.[Number(id)] || {}),
  };

  // Step 1: Try fetching children of the known business folderId
  if (entry.folderId) {
    try {
      const bizFolder = await folderService.viewFolder(entry.folderId as number, true);
      mergeSubs(entry, bizFolder.folderDtos || []);
    } catch {
      // viewFolder failed — continue with subfolder creation
    }
  }

  // Step 2: Create any still-missing category subfolders
  if (entry.folderId && !isComplete(entry as BusinessFolders)) {
    const missing = SUBFOLDERS.filter((name) => !entry[CATEGORY_SLOT_MAP[name]]);
    if (missing.length > 0) {
      try {
        const newSubs = await folderService.createMultipleFolders(
          missing.map((name) => ({ folderName: name, parentFolderId: entry.folderId as number })),
        );
        mergeSubs(entry, newSubs);
      } catch {
        // subfolder creation failed — proceed
      }
    }
  }

  // Step 3: Full creation if business folder doesn't exist
  if (!entry.folderId) {
    const businessRoleFolderId = roleFolders?.Business;
    if (!businessRoleFolderId) {
      throw new Error('[ensureBusinessDmsFolders] Business role folder ID not found');
    }
    const created = await createBusinessDmsFolders(id, bizName, businessRoleFolderId);
    Object.assign(entry, created);
  }

  // Persist the repaired entry
  await patchFolderMap(folderMap, Number(id), entry as BusinessFolders);
  return entry as BusinessFolders;
}

// ── Role folder repair ──────────────────────────────────────────────────────

async function _ensureRoleFolders(
  folderMap: DmsFolderMap,
): Promise<{ Business: number; Customer: number; Employee: number }> {
  if (isRoleFoldersComplete(folderMap.roleFolders)) {
    return folderMap.roleFolders;
  }

  if (_inProgress.has(_ROLE_KEY)) {
    await _inProgress.get(_ROLE_KEY);
    const latest = (await getDmsFolderMap()) || ({} as DmsFolderMap);
    return latest.roleFolders || ({} as { Business: number; Customer: number; Employee: number });
  }

  const promise = _doRoleRepair(folderMap).finally(() => _inProgress.delete(_ROLE_KEY));
  _inProgress.set(_ROLE_KEY, promise);
  return promise;
}

async function _doRoleRepair(
  folderMap: DmsFolderMap,
): Promise<{ Business: number; Customer: number; Employee: number }> {
  const userRootFolderId = folderMap.userRootFolderId;
  if (!userRootFolderId) {
    throw new Error('[ensureBusinessDmsFolders] userRootFolderId not found in dmsFolderMap');
  }

  const existing: Record<string, number> = { ...(folderMap.roleFolders || {}) };
  const missingRoles = ROLE_FOLDERS.filter((role) => !existing[role]);

  if (missingRoles.length === 0) {
    return existing as { Business: number; Customer: number; Employee: number };
  }

  try {
    const folderService = new FolderService();
    const newFolders = await folderService.createMultipleFolders(
      missingRoles.map((name) => ({ folderName: name, parentFolderId: userRootFolderId })),
    );
    newFolders.forEach((f) => {
      existing[f.folderName] = f.folderId!;
    });
  } catch {
    // role folder creation failed — proceed with partial folders
  }

  // Persist
  const latest = (await getDmsFolderMap()) || ({} as DmsFolderMap);
  latest.roleFolders = {
    ...(latest.roleFolders || { Business: 0, Customer: 0, Employee: 0 }),
    ...existing,
  } as { Business: number; Customer: number; Employee: number };
  await setDmsFolderMap(latest);

  return existing as { Business: number; Customer: number; Employee: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isComplete(entry?: BusinessFolders | null): entry is BusinessFolders {
  return !!(
    entry?.productsFolderId &&
    entry?.servicesFolderId &&
    entry?.ordersFolderId &&
    entry?.appointmentsFolderId &&
    entry?.billsFolderId
  );
}

function isRoleFoldersComplete(
  roleFolders?: { Business: number; Customer: number; Employee: number },
): boolean {
  return !!roleFolders && ROLE_FOLDERS.every((role) => !!(roleFolders as Record<string, number>)[role]);
}

function mergeSubs(entry: Record<string, unknown>, folders: Array<{ folderName: string; folderId?: number }>) {
  folders.forEach((sf) => {
    const key = CATEGORY_SLOT_MAP[sf.folderName];
    if (key) entry[key] = sf.folderId;
  });
}

async function patchFolderMap(
  folderMap: DmsFolderMap,
  bizId: number,
  entry: BusinessFolders,
): Promise<void> {
  if (!folderMap.businesses) {
    folderMap.businesses = {};
  }
  folderMap.businesses[bizId] = entry;
  await setDmsFolderMap(folderMap);
}
