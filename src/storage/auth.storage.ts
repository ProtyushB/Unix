import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Key Constants ───────────────────────────────────────────────────────────

const KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  LOGGED_IN_USER: 'loggedInUser',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LoggedInUser {
  id: number;
  username: string;
  roles: string[];
  types?: string[];
  email: string;
}

export interface StoredUser {
  [key: string]: unknown;
}

// ─── Access Token ────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
}

export async function setAccessToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ACCESS_TOKEN, token);
}

export async function clearAccessToken(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.ACCESS_TOKEN);
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
}

export async function setRefreshToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
}

export async function clearRefreshToken(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.REFRESH_TOKEN);
}

// ─── User (full object) ─────────────────────────────────────────────────────

export async function getUser(): Promise<StoredUser | null> {
  const raw = await AsyncStorage.getItem(KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function setUser(user: StoredUser): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.USER);
}

// ─── Logged-In User ─────────────────────────────────────────────────────────

export async function getLoggedInUser(): Promise<LoggedInUser | null> {
  const raw = await AsyncStorage.getItem(KEYS.LOGGED_IN_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoggedInUser;
  } catch {
    return null;
  }
}

export async function setLoggedInUser(user: LoggedInUser): Promise<void> {
  await AsyncStorage.setItem(KEYS.LOGGED_IN_USER, JSON.stringify(user));
}

export async function clearLoggedInUser(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.LOGGED_IN_USER);
}

// ─── Clear All Auth Data ─────────────────────────────────────────────────────

export async function clearAllAuth(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.ACCESS_TOKEN,
    KEYS.REFRESH_TOKEN,
    KEYS.USER,
    KEYS.LOGGED_IN_USER,
  ]);
}

export { KEYS as AUTH_KEYS };
