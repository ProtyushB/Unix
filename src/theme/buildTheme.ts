import { themes, darkPalette } from './colors';
import type { ThemeName } from './colors';
import { fontFamily, fontSize, lineHeight, textStyles } from './typography';
import { spacing, borderRadius } from './spacing';
import { DARK_STATUS, FALLBACK_STATUS, AVATAR_POOLS } from './tokens';
import { buildElevation } from './shapes';
import type { AppTheme, ThemeMode } from './theme.types';

// ─── Dark Base Palette ────────────────────────────────────────────────────────

const DARK_PALETTE = {
  background:      darkPalette.bg,
  surface:         darkPalette.surface,
  surfaceElevated: '#263348',
  onBackground:    darkPalette.text,
  onSurface:       '#e2e8f0',
  muted:           darkPalette.muted,
  divider:         darkPalette.border,
  overlay:         'rgba(0,0,0,0.6)',
  error:           '#ef4444',
  warning:         '#f59e0b',
  success:         '#10b981',
  info:            '#3b82f6',
} as const;

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

export function buildTheme(mode: ThemeMode, accentName: ThemeName): AppTheme {
  const accent = themes[accentName] ?? themes.default;
  // Light palette is architecture-ready; UI toggle ships in Phase 6.
  const palette = DARK_PALETTE;
  const statusMap = DARK_STATUS;

  return {
    name: accentName,
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
      border:       accent.border,
      softBg:       accent.softBg,
      shadow:       accent.shadow,
      glow:         accent.glow,
    },

    palette,

    // Plain object with uppercase keys; consumers normalise before lookup.
    // FALLBACK_STATUS is used by StatusPill for unknown keys.
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
