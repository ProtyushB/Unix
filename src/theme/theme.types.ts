import type { ViewStyle } from 'react-native';
import type { ThemeName } from './colors';
import { fontFamily, fontSize, lineHeight, textStyles } from './typography';
import { spacing, borderRadius } from './spacing';

// ─── Theme Axes ──────────────────────────────────────────────────────────────

export type AccentName = ThemeName;
export type ThemeMode = 'dark' | 'light';

// ─── Sub-type Shapes ─────────────────────────────────────────────────────────

export interface StatusColorSet {
  bg: string;
  text: string;
  border: string;
}

export interface AvatarColorPair {
  bg: string;
  text: string;
}

export interface GradientConfig {
  colors: string[];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// ─── Theme Actions (exposed by ThemeActionsContext) ───────────────────────────

export interface ThemeActions {
  setAccent: (name: AccentName) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

// ─── Full Theme Object (returned by useTheme) ─────────────────────────────────

export interface AppTheme {
  /** Current accent name ('default' | 'ocean' | …) */
  name: AccentName;
  /** Current color mode */
  mode: ThemeMode;

  /**
   * Accent-driven colors — change when the user picks a new theme accent.
   * Use these for interactive elements: buttons, active indicators, links.
   */
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    gradientFrom: string;
    gradientTo: string;
    bg: string;
    bgHover: string;
    text: string;
    textHover: string;
    border: string;
    softBg: string;
    shadow: string;
    glow: string;
  };

  /**
   * Mode-driven base palette — change when switching dark ↔ light mode.
   * Use these for backgrounds, text, and structural elements.
   */
  palette: {
    background: string;
    surface: string;
    surfaceElevated: string;
    onBackground: string;
    onSurface: string;
    muted: string;
    divider: string;
    overlay: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };

  /**
   * Status colors keyed by SCREAMING_SNAKE_CASE status string.
   * Each value is a full { bg, text, border } triple.
   */
  status: Record<string, StatusColorSet>;

  /** Avatar color pool + deterministic name-based lookup. */
  avatar: {
    pools: AvatarColorPair[];
    forName: (name: string) => AvatarColorPair;
  };

  /** Pre-built gradient configs — pass spread directly to LinearGradient. */
  gradients: {
    primary: GradientConfig;
    surface: GradientConfig;
    hero: GradientConfig;
  };

  /** Platform-aware elevation / shadow presets. Spread onto ViewStyle. */
  elevation: {
    none: ViewStyle;
    low: ViewStyle;
    medium: ViewStyle;
    high: ViewStyle;
    glow: ViewStyle;
  };

  /** Typography tokens — pass-through from typography.ts */
  typography: {
    fontFamily: typeof fontFamily;
    fontSize: typeof fontSize;
    lineHeight: typeof lineHeight;
    textStyles: typeof textStyles;
  };

  /** Spacing tokens — pass-through from spacing.ts */
  spacing: {
    scale: typeof spacing;
    borderRadius: typeof borderRadius;
  };
}
