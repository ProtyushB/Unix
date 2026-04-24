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
import { buildTheme } from '../theme/buildTheme';
import { DEFAULT_THEME, migrateLegacyTheme, type ThemeId } from '../theme/colors';
import type { AppTheme, ThemeActions } from '../theme/theme.types';

// ─── Context split ────────────────────────────────────────────────────────────
// ThemeContext        — holds the resolved AppTheme object (all display components).
// ThemeActionsContext — holds setters (only AccountScreen / settings).
// Splitting prevents setter re-creation from causing display re-renders.

const ThemeContext = createContext<AppTheme | undefined>(undefined);
const ThemeActionsContext = createContext<ThemeActions | undefined>(undefined);

const STORAGE_KEY = 'theme';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  // Hydrate from AsyncStorage — migrates legacy accent values on first read.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        const migrated = migrateLegacyTheme(stored);
        setThemeIdState(migrated);
        // Persist migration so legacy values don't linger.
        if (stored !== migrated) {
          AsyncStorage.setItem(STORAGE_KEY, migrated).catch(() => {});
        }
      })
      .finally(() => setReady(true));
  }, []);

  // Derive full theme — recomputes only when themeId changes.
  const theme = useMemo(() => buildTheme(themeId), [themeId]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const actions = useMemo<ThemeActions>(
    () => ({ setTheme }),
    [setTheme],
  );

  // Block render until theme is loaded — prevents flash of wrong theme.
  if (!ready) return null;

  return (
    <ThemeActionsContext.Provider value={actions}>
      <ThemeContext.Provider value={theme}>
        {children}
      </ThemeContext.Provider>
    </ThemeActionsContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeActions(): ThemeActions {
  const ctx = useContext(ThemeActionsContext);
  if (!ctx) throw new Error('useThemeActions must be used within ThemeProvider');
  return ctx;
}
