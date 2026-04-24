import { getThemeDefinition, type ThemeId } from './colors';
import { fontFamily, fontSize, lineHeight, textStyles } from './typography';
import { spacing, borderRadius } from './spacing';
import { DARK_STATUS, LIGHT_STATUS, FALLBACK_STATUS, AVATAR_POOLS } from './tokens';
import { buildElevation } from './shapes';
import type { AppTheme } from './theme.types';

// ─── Avatar Hash ─────────────────────────────────────────────────────────────
// Matches the original AvatarBadge hash so existing name→colour assignments don't change.

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// ─── Composition ─────────────────────────────────────────────────────────────

export function buildTheme(themeId: ThemeId): AppTheme {
  const def = getThemeDefinition(themeId);
  const { palette, accent, mode } = def;
  const statusMap = mode === 'dark' ? DARK_STATUS : LIGHT_STATUS;

  return {
    name: def.id,
    mode,

    colors: {
      primary:      accent.primary,
      secondary:    accent.secondary,
      tertiary:     accent.tertiary,
      gradientFrom: accent.gradientFrom,
      gradientTo:   accent.gradientTo,
      bg:           accent.bg,
      bgHover:      accent.bgHover,
      text:         accent.text,
      textHover:    accent.textHover,
      onAccent:     accent.onAccent,
      border:       accent.border,
      softBg:       accent.softBg,
      shadow:       accent.shadow,
      glow:         accent.glow,
    },

    palette,

    status: { ...statusMap, FALLBACK: FALLBACK_STATUS },

    avatar: {
      pools:   AVATAR_POOLS,
      forName: (name: string) => AVATAR_POOLS[hashName(name) % AVATAR_POOLS.length],
    },

    gradients: {
      primary: {
        colors: [accent.gradientFrom, accent.gradientTo],
        start: { x: 0, y: 0 },
        end:   { x: 1, y: 1 },
      },
      surface: {
        colors: [palette.surface, palette.background],
        start: { x: 0, y: 0 },
        end:   { x: 0, y: 1 },
      },
      hero: {
        colors: [accent.gradientFrom, accent.bg, palette.background],
        start: { x: 0, y: 0 },
        end:   { x: 0, y: 1 },
      },
    },

    elevation: buildElevation(accent.glow),

    typography: { fontFamily, fontSize, lineHeight, textStyles },

    spacing: { scale: spacing, borderRadius },
  };
}
