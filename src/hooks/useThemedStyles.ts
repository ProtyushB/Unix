import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './useTheme';
import type { AppTheme } from '../theme/theme.types';

/**
 * Creates a memoised StyleSheet from a module-level factory function.
 *
 * Rules:
 *  - `factory` MUST be defined at module level (stable reference).
 *  - The memo re-runs only when the theme reference changes (i.e. on theme switch).
 *  - For prop/state-dependent style variants, pass extra args through the factory:
 *      `useThemedStyles((t) => createStyles(t, { variant, disabled }))`
 *    Define `createStyles` at module level and pre-compute all variants.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T,
): T {
  const theme = useTheme();
  // factory is always a stable module-level constant — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
