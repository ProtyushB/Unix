import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Key Constants (namespaced with "session:" prefix) ───────────────────────

const PREFIX = 'session:';

const KEYS = {
  SIGNUP_DATA: `${PREFIX}signupData`,
  COMPLETE_PROFILE_DATA: `${PREFIX}completeProfileData`,
  USER_PROFILE: `${PREFIX}userProfile`,
  BUSINESS_TYPE_MAP: `${PREFIX}businessTypeMap`,
  SELECTED_BUSINESS_TYPE: `${PREFIX}selectedBusinessType`,
  SELECTED_BUSINESS: `${PREFIX}selectedBusiness`,
  ACTIVE_TAB: `${PREFIX}activeTab`,
  DMS_PREVIEW_FOLDERS: `${PREFIX}dmsPreviewFolders`,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SignupData {
  username: string;
  email: string;
  password: string;
}

export interface Business {
  id: number;
  name: string;
  businessType: string;
  [key: string]: unknown;
}

export interface CompleteProfileData {
  person: Record<string, unknown>;
  businesses: Business[];
  [key: string]: unknown;
}

export interface UserProfile {
  [key: string]: unknown;
}

export type BusinessTypeMap = Record<string, Business[]>;

export interface DmsPreviewFolders {
  [key: string]: unknown;
}

// ─── Signup Data ─────────────────────────────────────────────────────────────

export async function getSignupData(): Promise<SignupData | null> {
  const raw = await AsyncStorage.getItem(KEYS.SIGNUP_DATA);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignupData;
  } catch {
    return null;
  }
}

export async function setSignupData(data: SignupData): Promise<void> {
  await AsyncStorage.setItem(KEYS.SIGNUP_DATA, JSON.stringify(data));
}

// ─── Complete Profile Data ───────────────────────────────────────────────────

export async function getCompleteProfileData(): Promise<CompleteProfileData | null> {
  const raw = await AsyncStorage.getItem(KEYS.COMPLETE_PROFILE_DATA);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CompleteProfileData;
  } catch {
    return null;
  }
}

export async function setCompleteProfileData(data: CompleteProfileData): Promise<void> {
  await AsyncStorage.setItem(KEYS.COMPLETE_PROFILE_DATA, JSON.stringify(data));
}

// ─── User Profile ────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(KEYS.USER_PROFILE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function setUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
}

// ─── Business Type Map ───────────────────────────────────────────────────────

export async function getBusinessTypeMap(): Promise<BusinessTypeMap | null> {
  const raw = await AsyncStorage.getItem(KEYS.BUSINESS_TYPE_MAP);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BusinessTypeMap;
  } catch {
    return null;
  }
}

export async function setBusinessTypeMap(map: BusinessTypeMap): Promise<void> {
  await AsyncStorage.setItem(KEYS.BUSINESS_TYPE_MAP, JSON.stringify(map));
}

// ─── Selected Business Type ──────────────────────────────────────────────────

export async function getSelectedBusinessType(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.SELECTED_BUSINESS_TYPE);
}

export async function setSelectedBusinessType(type: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.SELECTED_BUSINESS_TYPE, type);
}

// ─── Selected Business ───────────────────────────────────────────────────────

export async function getSelectedBusiness(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.SELECTED_BUSINESS);
}

export async function setSelectedBusiness(business: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.SELECTED_BUSINESS, business);
}

// ─── Active Tab ──────────────────────────────────────────────────────────────

export async function getActiveTab(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ACTIVE_TAB);
}

export async function setActiveTab(tab: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ACTIVE_TAB, tab);
}

// ─── DMS Preview Folders ─────────────────────────────────────────────────────

export async function getDmsPreviewFolders(): Promise<DmsPreviewFolders | null> {
  const raw = await AsyncStorage.getItem(KEYS.DMS_PREVIEW_FOLDERS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DmsPreviewFolders;
  } catch {
    return null;
  }
}

export async function setDmsPreviewFolders(folders: DmsPreviewFolders): Promise<void> {
  await AsyncStorage.setItem(KEYS.DMS_PREVIEW_FOLDERS, JSON.stringify(folders));
}

// ─── Clear All Session Data ──────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

export { KEYS as SESSION_KEYS };
