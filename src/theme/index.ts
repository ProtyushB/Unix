// ─── Theme registry ───────────────────────────────────────────────────────────
export {
  THEMES,
  THEME_IDS,
  DEFAULT_THEME,
  getThemeDefinition,
  migrateLegacyTheme,
  type ThemeId,
  type ThemeMode,
  type ThemeDefinition,
  type ThemePalette,
  type ThemeAccent,
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

// ─── Theme system ─────────────────────────────────────────────────────────────
export { buildTheme } from './buildTheme';
export type { AppTheme, ThemeActions, StatusColorSet, AvatarColorPair, GradientConfig } from './theme.types';
export { DARK_STATUS, LIGHT_STATUS, FALLBACK_STATUS, AVATAR_POOLS } from './tokens';
