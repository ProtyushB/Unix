// ─── Legacy token exports (kept for backward compatibility) ──────────────────
export {
  darkPalette,
  themes,
  getTheme,
  type ThemeName,
  type AccentTheme,
} from './colors';

export {
  fontFamily,
  fontSize,
  lineHeight,
  textStyles,
} from './typography';

export {
  spacing,
  borderRadius,
} from './spacing';

// ─── New theme system ─────────────────────────────────────────────────────────
export { buildTheme } from './buildTheme';
export type { AppTheme, AccentName, ThemeMode, ThemeActions, StatusColorSet, AvatarColorPair, GradientConfig } from './theme.types';
export { DARK_STATUS, FALLBACK_STATUS, AVATAR_POOLS } from './tokens';
