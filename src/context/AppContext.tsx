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
import {
  getSelectedBusiness as loadSelectedBusiness,
  setSelectedBusiness as saveSelectedBusiness,
  setSelectedBusinessType as saveSelectedBusinessType,
  getBusinessTypeMap,
} from '../storage/session.storage';

// ─── Key ─────────────────────────────────────────────────────────────────────

const MODULE_KEY = 'session:selectedModule';

// ─── Context Shape ───────────────────────────────────────────────────────────
// Theme state has moved to ThemeContext / ThemeProvider.

interface AppContextValue {
  selectedBusiness: string | null;
  setSelectedBusiness: (business: string | null) => void;
  selectedModule: string | null;
  setSelectedModule: (module: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [selectedBusiness, setSelectedBusinessState] = useState<string | null>(null);
  const [selectedModule, setSelectedModuleState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedBusiness, storedModule] = await Promise.all([
          loadSelectedBusiness(),
          AsyncStorage.getItem(MODULE_KEY),
        ]);

        if (storedBusiness && storedModule) {
          setSelectedBusinessState(storedBusiness);
          setSelectedModuleState(storedModule);
          // Keep the module hooks' key in sync on restore too — it lives under
          // a separate storage key and would otherwise stay unset.
          saveSelectedBusinessType(storedModule).catch(() => {});
          return;
        }

        // Nothing chosen yet (first login): default to the first business so
        // the portal has something to load instead of an empty shell.
        const map = await getBusinessTypeMap();
        const firstType = map ? Object.keys(map).find(t => (map[t] || []).length > 0) : undefined;
        const firstBiz = firstType ? map![firstType][0] : undefined;
        if (firstType && firstBiz) {
          const name = firstBiz.businessName || firstBiz.name;
          setSelectedModuleState(firstType);
          setSelectedBusinessState(name);
          await Promise.all([
            AsyncStorage.setItem(MODULE_KEY, firstType),
            saveSelectedBusiness(name),
            saveSelectedBusinessType(firstType),
          ]);
        }
      } catch {
        // Silently fall back to defaults
      }
    })();
  }, []);

  const setSelectedBusiness = useCallback((next: string | null) => {
    setSelectedBusinessState(next);
    if (next) {
      saveSelectedBusiness(next).catch(() => {});
    } else {
      AsyncStorage.removeItem('session:selectedBusiness').catch(() => {});
    }
  }, []);

  const setSelectedModule = useCallback((next: string | null) => {
    setSelectedModuleState(next);
    if (next) {
      AsyncStorage.setItem(MODULE_KEY, next).catch(() => {});
      // Mirror into `session:selectedBusinessType`, which is what
      // useModuleService.getSelectedBusinessId reads to resolve the business id.
      saveSelectedBusinessType(next).catch(() => {});
    } else {
      AsyncStorage.removeItem(MODULE_KEY).catch(() => {});
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ selectedBusiness, setSelectedBusiness, selectedModule, setSelectedModule }),
    [selectedBusiness, setSelectedBusiness, selectedModule, setSelectedModule],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within an AppProvider');
  return ctx;
}

export default AppContext;
