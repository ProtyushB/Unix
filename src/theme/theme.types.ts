import type { ViewStyle } from 'react-native';
import type { ThemeId, ThemeMode } from './colors';
import { fontFamily, fontSize, lineHeight, textStyles } from './typography';
import { spacing, borderRadius } from './spacing';

export type { ThemeId, ThemeMode } from './colors';

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
  setTheme: (id: ThemeId) => void;
}

// ─── Full Theme Object (returned by useTheme) ─────────────────────────────────

export interface AppTheme {
  /** Current theme id (one of the 16 registry keys). */
  name: ThemeId;
  /** Current color mode — derived from the theme definition. */
  mode: ThemeMode;

  /**
   * Accent-driven colors — change with the theme. Use these for interactive
   * elements: buttons, active indicators, links, progress bars.
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
    /** Text color placed on top of `bg` — defaults to white, dark on high-luminance accents. */
    onAccent: string;
    border: string;
    softBg: string;
    shadow: string;
    glow: string;
  };

  /**
   * Base palette — surfaces, text, structural colors. Each theme defines its
   * own palette, so two dark themes may have different backgrounds.
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
    /** Accent-tinted sheen overlay — rendered over cards on dark themes, transparent on light themes. */
    sheenStart: string;
    sheenEnd: string;
    /** Page gradient edge color (top/bottom). Gives BlurView something to blur against on dark themes. */
    pageEdge: string;
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
