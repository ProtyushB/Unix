import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Key Constant ────────────────────────────────────────────────────────────

const KEY = 'dmsFolderMap';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BusinessFolders {
  folderId: number;
  productsFolderId: number;
  servicesFolderId: number;
  ordersFolderId: number;
  appointmentsFolderId: number;
  billsFolderId: number;
}

export interface DmsFolderMap {
  userRootFolderId: number;
  roleFolders: {
    Business: number;
    Customer: number;
    Employee: number;
  };
  businesses: Record<number, BusinessFolders>;
}

// ─── Get ─────────────────────────────────────────────────────────────────────

export async function getDmsFolderMap(): Promise<DmsFolderMap | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DmsFolderMap;
  } catch {
    return null;
  }
}

// ─── Set ─────────────────────────────────────────────────────────────────────

export async function setDmsFolderMap(map: DmsFolderMap): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

// ─── Clear ───────────────────────────────────────────────────────────────────

export async function clearDmsFolderMap(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export { KEY as DMS_KEY };
