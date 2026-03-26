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
import type { AppTheme, ThemeActions, AccentName, ThemeMode } from '../theme/theme.types';

// ─── Valid accent names ───────────────────────────────────────────────────────

const VALID_ACCENTS = new Set<string>([
  'default', 'ocean', 'rose', 'emerald', 'violet', 'parlour',
]);

function isValidAccent(v: string | null): v is AccentName {
  return v !== null && VALID_ACCENTS.has(v);
}

// ─── Context split ────────────────────────────────────────────────────────────
// ThemeContext   — holds the resolved AppTheme object (all 37+ display components)
// ThemeActionsContext — holds setters (only AccountScreen / settings)
// Splitting prevents setter re-creation from causing display re-renders.

const ThemeContext = createContext<AppTheme | undefined>(undefined);
const ThemeActionsContext = createContext<ThemeActions | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentName, setAccentState] = useState<AccentName>('default');
  // Mode is architecture-ready; UI toggle ships in Phase 6.
  const [mode] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  // Hydrate from AsyncStorage — same key ('theme') as the old AppContext.
  useEffect(() => {
    AsyncStorage.getItem('theme')
      .then(stored => {
        if (isValidAccent(stored)) {
          setAccentState(stored);
        }
      })
      .finally(() => setReady(true));
  }, []);

  // Derive full theme — recomputes only when accent or mode changes.
  const theme = useMemo(() => buildTheme(mode, accentName), [mode, accentName]);

  const setAccent = useCallback((name: AccentName) => {
    setAccentState(name);
    AsyncStorage.setItem('theme', name).catch(() => {});
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setMode = useCallback((_m: ThemeMode) => {
    // Architecture-ready; wired up in Phase 6 when light mode ships.
  }, []);

  const toggleMode = useCallback(() => {
    // Architecture-ready; wired up in Phase 6 when light mode ships.
  }, []);

  const actions = useMemo<ThemeActions>(
    () => ({ setAccent, setMode, toggleMode }),
    [setAccent, setMode, toggleMode],
  );

  // Block render until theme is loaded — prevents flash of wrong accent.
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
