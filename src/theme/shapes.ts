import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ElevationSet {
  none: ViewStyle;
  low: ViewStyle;
  medium: ViewStyle;
  high: ViewStyle;
  /** Coloured glow — uses the current accent's glow token. */
  glow: ViewStyle;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function buildElevation(glowColor: string): ElevationSet {
  return {
    none: {},

    low: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }) ?? {},

    medium: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }) ?? {},

    high: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }) ?? {},

    glow: Platform.select({
      ios: {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }) ?? {},
  };
}
