import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSelectedBusiness as loadBusiness,
  setSelectedBusiness as saveBusiness,
} from '../storage/session.storage';

// ─── Storage key for module (matches AppContext) ─────────────────────────────

const MODULE_KEY = 'session:selectedModule';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBusinessSelector() {
  const [selectedBusiness, setSelectedBusinessState] = useState<string | null>(null);
  const [selectedModule, setSelectedModuleState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [business, module_] = await Promise.all([
          loadBusiness(),
          AsyncStorage.getItem(MODULE_KEY),
        ]);

        if (mounted) {
          setSelectedBusinessState(business);
          setSelectedModuleState(module_);
        }
      } catch {
        // Silently fall back to null
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Persist business selection
  const setSelectedBusiness = useCallback((business: string | null) => {
    setSelectedBusinessState(business);
    if (business) {
      saveBusiness(business).catch(() => {});
    } else {
      AsyncStorage.removeItem('session:selectedBusiness').catch(() => {});
    }
  }, []);

  // Persist module selection
  const setSelectedModule = useCallback((module: string | null) => {
    setSelectedModuleState(module);
    if (module) {
      AsyncStorage.setItem(MODULE_KEY, module).catch(() => {});
    } else {
      AsyncStorage.removeItem(MODULE_KEY).catch(() => {});
    }
  }, []);

  return {
    selectedBusiness,
    selectedModule,
    setSelectedBusiness,
    setSelectedModule,
    loading,
  } as const;
}
