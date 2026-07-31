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
  SESSION_KEYS,
} from '../storage/session.storage';

// ─── Key ─────────────────────────────────────────────────────────────────────
// Owned by session.storage so logoutClear sweeps it with the rest of the session — see the note
// on SELECTED_MODULE there.

const MODULE_KEY = SESSION_KEYS.SELECTED_MODULE;

// ─── Context Shape ───────────────────────────────────────────────────────────
// Theme state has moved to ThemeContext / ThemeProvider.

interface AppContextValue {
  selectedBusiness: string | null;
  setSelectedBusiness: (business: string | null) => void;
  selectedModule: string | null;
  setSelectedModule: (module: string | null) => void;
  /**
   * Re-read the persisted selection.
   *
   * Hydration otherwise runs once, at process start. On a first login that is BEFORE the business
   * map exists, so the fallback below finds nothing and the selection stays null for the whole
   * session — the portal then renders with no business, and anything keyed on it (tab config,
   * dashboard) silently never loads. Login and signup call this once they have written the map.
   */
  hydrateSelection: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [selectedBusiness, setSelectedBusinessState] = useState<string | null>(null);
  const [selectedModule, setSelectedModuleState] = useState<string | null>(null);

  const hydrateSelection = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    hydrateSelection();
  }, [hydrateSelection]);

  const setSelectedBusiness = useCallback((next: string | null) => {
    setSelectedBusinessState(next);
    if (next) {
      saveSelectedBusiness(next).catch(() => {});
    } else {
      AsyncStorage.removeItem(SESSION_KEYS.SELECTED_BUSINESS).catch(() => {});
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
    () => ({
      selectedBusiness,
      setSelectedBusiness,
      selectedModule,
      setSelectedModule,
      hydrateSelection,
    }),
    [selectedBusiness, setSelectedBusiness, selectedModule, setSelectedModule, hydrateSelection],
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
