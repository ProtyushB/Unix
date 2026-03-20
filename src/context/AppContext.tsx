import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ThemeName } from '../theme/colors';
import {
  getSelectedBusiness as loadSelectedBusiness,
  setSelectedBusiness as saveSelectedBusiness,
} from '../storage/session.storage';

// ─── AsyncStorage key for theme (lives outside session namespace) ────────────

const THEME_KEY = 'theme';

// ─── We store selectedModule in session storage under this key ────────────────

const MODULE_KEY = 'session:selectedModule';

// ─── Context Shape ───────────────────────────────────────────────────────────

interface AppContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  selectedBusiness: string | null;
  setSelectedBusiness: (business: string | null) => void;
  selectedModule: string | null;
  setSelectedModule: (module: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ─── Valid theme names for runtime guard ─────────────────────────────────────

const VALID_THEMES: ReadonlySet<string> = new Set<string>([
  'default',
  'ocean',
  'rose',
  'emerald',
  'violet',
  'parlour',
]);

function isValidTheme(value: string | null): value is ThemeName {
  return value !== null && VALID_THEMES.has(value);
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>('default');
  const [selectedBusiness, setSelectedBusinessState] = useState<string | null>(null);
  const [selectedModule, setSelectedModuleState] = useState<string | null>(null);

  // Hydrate from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedTheme, storedBusiness, storedModule] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          loadSelectedBusiness(),
          AsyncStorage.getItem(MODULE_KEY),
        ]);

        if (isValidTheme(storedTheme)) {
          setThemeState(storedTheme);
        }
        if (storedBusiness) {
          setSelectedBusinessState(storedBusiness);
        }
        if (storedModule) {
          setSelectedModuleState(storedModule);
        }
      } catch {
        // Silently fall back to defaults
      }
    })();
  }, []);

  // Persist theme changes
  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  // Persist selected business changes
  const setSelectedBusiness = useCallback((next: string | null) => {
    setSelectedBusinessState(next);
    if (next) {
      saveSelectedBusiness(next).catch(() => {});
    } else {
      AsyncStorage.removeItem('session:selectedBusiness').catch(() => {});
    }
  }, []);

  // Persist selected module changes
  const setSelectedModule = useCallback((next: string | null) => {
    setSelectedModuleState(next);
    if (next) {
      AsyncStorage.setItem(MODULE_KEY, next).catch(() => {});
    } else {
      AsyncStorage.removeItem(MODULE_KEY).catch(() => {});
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      setTheme,
      selectedBusiness,
      setSelectedBusiness,
      selectedModule,
      setSelectedModule,
    }),
    [theme, setTheme, selectedBusiness, setSelectedBusiness, selectedModule, setSelectedModule],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}

export default AppContext;
