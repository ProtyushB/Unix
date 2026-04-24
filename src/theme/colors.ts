// ─── Theme Registry ──────────────────────────────────────────────────────────
//
// 16 complete-palette themes ported from Centrix (web). Each theme declares
// its own surfaces, text, borders, and accent — mode is a property of the
// theme, not an independent axis. This is a departure from the old
// accent × mode matrix.
//
// Solid-color approximation: web CSS uses rgba surface layers that composite
// over the page background. React Native can't composite on the fly, so each
// theme's `palette.surface` / `surfaceElevated` are baked-in hex colors that
// approximate the composited look.

export type ThemeMode = 'dark' | 'light';

export type ThemeId =
  | 'midnight' | 'ocean' | 'forest' | 'obsidian'
  | 'rose' | 'gilded' | 'onyx' | 'banarasi'
  | 'dawn' | 'sky' | 'sage' | 'lavender'
  | 'blush' | 'champagne' | 'pearl' | 'brocade';

export interface ThemePalette {
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
  /**
   * Accent-tinted sheen overlay — rendered diagonally over cards on dark
   * themes to mimic the web's glassmorphic look. Light themes set this to
   * `'transparent'` so cards stay flat.
   */
  sheenStart: string;
  sheenEnd: string;
  /**
   * Edge color of the page gradient (top/bottom vs `background` in middle).
   * Gives BlurView something visually complex to blur against. Light themes
   * set this equal to `background` so no gradient is visible.
   */
  pageEdge: string;
}

export interface ThemeAccent {
  primary: string;
  secondary: string;
  tertiary: string;
  gradientFrom: string;
  gradientTo: string;
  bg: string;
  bgHover: string;
  text: string;
  textHover: string;
  /** Text color placed on top of `bg` — dark for high-luminance accents (gold/silver). */
  onAccent: string;
  border: string;
  softBg: string;
  shadow: string;
  glow: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  description: string;
  /** [surface, accent] — used by the picker preview tile. */
  swatch: [string, string];
  palette: ThemePalette;
  accent: ThemeAccent;
}

// ─── Shared status colors for dark-mode themes ──────────────────────────────

const DARK_STATUS_PALETTE = {
  error:   '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
  info:    '#60a5fa',
};

// Rose / Gilded / Onyx / Banarasi use a softer error color matching their palette.
const DARK_STATUS_PALETTE_SOFT = {
  error:   '#fda4af',
  warning: '#fbbf24',
  success: '#34d399',
  info:    '#60a5fa',
};

const LIGHT_STATUS_PALETTE = {
  error:   '#b91c1c',
  warning: '#b45309',
  success: '#047857',
  info:    '#1e40af',
};

// Backdrop scrim behind bottom sheets. Deliberately light on dark themes so
// the blurred dashboard content behind the sheet stays visible (matching the
// web glass pattern where the dropdown sits over the chart without a heavy
// scrim). Light themes get a slightly darker scrim for modality.
const DARK_OVERLAY = 'rgba(0,0,0,0.15)';
const LIGHT_OVERLAY = 'rgba(15,23,42,0.2)';

// ─── Theme Definitions ──────────────────────────────────────────────────────

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  // ═══ DARK ═══════════════════════════════════════════════════════════════

  midnight: {
    id: 'midnight', name: 'Midnight', mode: 'dark',
    description: 'Deep slate with warm orange',
    swatch: ['#0f172a', '#f97316'],
    palette: {
      background:      '#0f172a',
      surface:         '#1e293b',
      surfaceElevated: '#334155',
      onBackground:    '#f1f5f9',
      onSurface:       '#cbd5e1',
      muted:           '#94a3b8',
      divider:         '#475569',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(249, 115, 22, 0.05)',
      sheenEnd:        'rgba(251, 146, 60, 0.05)',
      pageEdge:        '#020617',
      ...DARK_STATUS_PALETTE,
    },
    accent: {
      primary: '#f97316', secondary: '#fb923c', tertiary: '#fdba74',
      gradientFrom: '#f97316', gradientTo: '#fb923c',
      bg: '#f97316', bgHover: '#fb923c',
      text: '#fb923c', textHover: '#fdba74',
      onAccent: '#ffffff',
      border: '#f9731640', softBg: '#f9731620', shadow: '#f9731633', glow: '#f9731666',
    },
  },

  ocean: {
    id: 'ocean', name: 'Ocean', mode: 'dark',
    description: 'Navy depths with cyan',
    swatch: ['#0c1a2e', '#0ea5e9'],
    palette: {
      background:      '#0c1a2e',
      surface:         '#142744',
      surfaceElevated: '#1e3858',
      onBackground:    '#e0f2fe',
      onSurface:       '#bae6fd',
      muted:           '#7dd3fc',
      divider:         '#1e3a5f',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(14, 165, 233, 0.05)',
      sheenEnd:        'rgba(56, 189, 248, 0.05)',
      pageEdge:        '#020617',
      ...DARK_STATUS_PALETTE,
    },
    accent: {
      primary: '#0ea5e9', secondary: '#38bdf8', tertiary: '#7dd3fc',
      gradientFrom: '#0284c7', gradientTo: '#06b6d4',
      bg: '#0ea5e9', bgHover: '#38bdf8',
      text: '#38bdf8', textHover: '#7dd3fc',
      onAccent: '#ffffff',
      border: '#0ea5e940', softBg: '#0ea5e920', shadow: '#0ea5e933', glow: '#0ea5e966',
    },
  },

  forest: {
    id: 'forest', name: 'Forest', mode: 'dark',
    description: 'Charcoal with emerald',
    swatch: ['#0a1814', '#10b981'],
    palette: {
      background:      '#0a1814',
      surface:         '#14251e',
      surfaceElevated: '#1f3a2e',
      onBackground:    '#d1fae5',
      onSurface:       '#a7f3d0',
      muted:           '#6ee7b7',
      divider:         '#1f3a2e',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(16, 185, 129, 0.05)',
      sheenEnd:        'rgba(52, 211, 153, 0.05)',
      pageEdge:        '#020c09',
      ...DARK_STATUS_PALETTE,
    },
    accent: {
      primary: '#10b981', secondary: '#34d399', tertiary: '#6ee7b7',
      gradientFrom: '#059669', gradientTo: '#14b8a6',
      bg: '#10b981', bgHover: '#34d399',
      text: '#34d399', textHover: '#6ee7b7',
      onAccent: '#ffffff',
      border: '#10b98140', softBg: '#10b98120', shadow: '#10b98133', glow: '#10b98166',
    },
  },

  obsidian: {
    id: 'obsidian', name: 'Obsidian', mode: 'dark',
    description: 'Near-black with violet',
    swatch: ['#0c0a14', '#8b5cf6'],
    palette: {
      background:      '#0c0a14',
      surface:         '#1d1624',
      surfaceElevated: '#2a1f4a',
      onBackground:    '#ede9fe',
      onSurface:       '#ddd6fe',
      muted:           '#c4b5fd',
      divider:         '#3b2a5c',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(139, 92, 246, 0.05)',
      sheenEnd:        'rgba(167, 139, 250, 0.05)',
      pageEdge:        '#03020a',
      ...DARK_STATUS_PALETTE,
    },
    accent: {
      primary: '#8b5cf6', secondary: '#a78bfa', tertiary: '#c4b5fd',
      gradientFrom: '#7c3aed', gradientTo: '#a855f7',
      bg: '#8b5cf6', bgHover: '#a78bfa',
      text: '#a78bfa', textHover: '#c4b5fd',
      onAccent: '#ffffff',
      border: '#8b5cf640', softBg: '#8b5cf620', shadow: '#8b5cf633', glow: '#8b5cf666',
    },
  },

  rose: {
    id: 'rose', name: 'Rose', mode: 'dark',
    description: 'Dark rose with pink accent',
    swatch: ['#1a0d14', '#e11d48'],
    palette: {
      background:      '#1a0d14',
      surface:         '#23141c',
      surfaceElevated: '#3c2332',
      onBackground:    '#fce7f3',
      onSurface:       '#fbcfe8',
      muted:           '#f9a8d4',
      divider:         '#6b2a47',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(225, 29, 72, 0.05)',
      sheenEnd:        'rgba(244, 63, 94, 0.05)',
      pageEdge:        '#0a0308',
      ...DARK_STATUS_PALETTE_SOFT,
    },
    accent: {
      primary: '#e11d48', secondary: '#f43f5e', tertiary: '#fb7185',
      gradientFrom: '#be123c', gradientTo: '#e11d48',
      bg: '#e11d48', bgHover: '#f43f5e',
      text: '#fb7185', textHover: '#fda4af',
      onAccent: '#ffffff',
      border: '#e11d4840', softBg: '#e11d4820', shadow: '#e11d4833', glow: '#e11d4866',
    },
  },

  gilded: {
    id: 'gilded', name: 'Gilded', mode: 'dark',
    description: 'Warm near-black with gold',
    swatch: ['#14100a', '#ca8a04'],
    palette: {
      background:      '#14100a',
      surface:         '#1e180e',
      surfaceElevated: '#2e2414',
      onBackground:    '#fef3c7',
      onSurface:       '#fde68a',
      muted:           '#c9b076',
      divider:         '#7a5c1e',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(202, 138, 4, 0.05)',
      sheenEnd:        'rgba(234, 179, 8, 0.05)',
      pageEdge:        '#0a0805',
      ...DARK_STATUS_PALETTE_SOFT,
    },
    accent: {
      primary: '#eab308', secondary: '#facc15', tertiary: '#fde047',
      gradientFrom: '#a16207', gradientTo: '#ca8a04',
      bg: '#ca8a04', bgHover: '#a16207',
      text: '#facc15', textHover: '#fde047',
      onAccent: '#ffffff',
      border: '#ca8a0440', softBg: '#ca8a0420', shadow: '#ca8a0433', glow: '#ca8a0466',
    },
  },

  onyx: {
    id: 'onyx', name: 'Onyx', mode: 'dark',
    description: 'Pure black with silver accent',
    swatch: ['#0a0a0a', '#d4d4d8'],
    palette: {
      background:      '#0a0a0a',
      surface:         '#18181b',
      surfaceElevated: '#27272a',
      onBackground:    '#fafafa',
      onSurface:       '#e4e4e7',
      muted:           '#a1a1aa',
      divider:         '#52525b',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(212, 212, 216, 0.05)',
      sheenEnd:        'rgba(244, 244, 245, 0.05)',
      pageEdge:        '#000000',
      ...DARK_STATUS_PALETTE_SOFT,
    },
    accent: {
      primary: '#d4d4d8', secondary: '#e4e4e7', tertiary: '#f4f4f5',
      gradientFrom: '#a1a1aa', gradientTo: '#d4d4d8',
      bg: '#d4d4d8', bgHover: '#e4e4e7',
      text: '#e4e4e7', textHover: '#f4f4f5',
      onAccent: '#0a0a0a',
      border: '#d4d4d840', softBg: '#d4d4d820', shadow: '#d4d4d833', glow: '#d4d4d866',
    },
  },

  banarasi: {
    id: 'banarasi', name: 'Banarasi', mode: 'dark',
    description: 'Deep plum silk with gold zari',
    swatch: ['#1a0b1a', '#d4a855'],
    palette: {
      background:      '#1a0b1a',
      surface:         '#2a122a',
      surfaceElevated: '#3a1c38',
      onBackground:    '#f5e6d3',
      onSurface:       '#e8d4b8',
      muted:           '#c9a97d',
      divider:         '#5a2650',
      overlay:         DARK_OVERLAY,
      sheenStart:      'rgba(212, 168, 85, 0.06)',
      sheenEnd:        'rgba(139, 48, 108, 0.06)',
      pageEdge:        '#0f0510',
      ...DARK_STATUS_PALETTE_SOFT,
    },
    accent: {
      primary: '#d4a855', secondary: '#e0b869', tertiary: '#ecc982',
      gradientFrom: '#a8752d', gradientTo: '#d4a855',
      bg: '#d4a855', bgHover: '#e0b869',
      text: '#ecc982', textHover: '#f5d99a',
      onAccent: '#1a0b1a',
      border: '#d4a85540', softBg: '#d4a85520', shadow: '#d4a85533', glow: '#d4a85566',
    },
  },

  // ═══ LIGHT ══════════════════════════════════════════════════════════════

  dawn: {
    id: 'dawn', name: 'Dawn', mode: 'light',
    description: 'Warm paper with amber',
    swatch: ['#fef7ed', '#d97706'],
    palette: {
      background:      '#fef7ed',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#1c1917',
      onSurface:       '#44403c',
      muted:           '#78716c',
      divider:         '#e7d9c2',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#fef7ed',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#d97706', secondary: '#f59e0b', tertiary: '#fbbf24',
      gradientFrom: '#b45309', gradientTo: '#d97706',
      bg: '#d97706', bgHover: '#b45309',
      text: '#b45309', textHover: '#92400e',
      onAccent: '#ffffff',
      border: '#d977064d', softBg: '#d977061a', shadow: '#d9770638', glow: '#d9770647',
    },
  },

  sky: {
    id: 'sky', name: 'Sky', mode: 'light',
    description: 'Cool white with sky blue',
    swatch: ['#f8fafc', '#0284c7'],
    palette: {
      background:      '#f8fafc',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#0f172a',
      onSurface:       '#334155',
      muted:           '#64748b',
      divider:         '#cbd5e1',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#f8fafc',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#0284c7', secondary: '#0ea5e9', tertiary: '#38bdf8',
      gradientFrom: '#0369a1', gradientTo: '#0284c7',
      bg: '#0284c7', bgHover: '#0369a1',
      text: '#0369a1', textHover: '#075985',
      onAccent: '#ffffff',
      border: '#0284c74d', softBg: '#0284c714', shadow: '#0284c733', glow: '#0284c740',
    },
  },

  sage: {
    id: 'sage', name: 'Sage', mode: 'light',
    description: 'Mint tint with emerald',
    swatch: ['#f0fdf4', '#059669'],
    palette: {
      background:      '#f0fdf4',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#0f172a',
      onSurface:       '#374151',
      muted:           '#64748b',
      divider:         '#bbe0c8',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#f0fdf4',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#059669', secondary: '#10b981', tertiary: '#34d399',
      gradientFrom: '#047857', gradientTo: '#059669',
      bg: '#059669', bgHover: '#047857',
      text: '#047857', textHover: '#065f46',
      onAccent: '#ffffff',
      border: '#0596694d', softBg: '#0596691a', shadow: '#05966933', glow: '#05966940',
    },
  },

  lavender: {
    id: 'lavender', name: 'Lavender', mode: 'light',
    description: 'Soft violet tint',
    swatch: ['#faf5ff', '#7c3aed'],
    palette: {
      background:      '#faf5ff',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#0f172a',
      onSurface:       '#374151',
      muted:           '#6b7280',
      divider:         '#d8b4fe',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#faf5ff',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#7c3aed', secondary: '#8b5cf6', tertiary: '#a78bfa',
      gradientFrom: '#6d28d9', gradientTo: '#7c3aed',
      bg: '#7c3aed', bgHover: '#6d28d9',
      text: '#6d28d9', textHover: '#5b21b6',
      onAccent: '#ffffff',
      border: '#7c3aed4d', softBg: '#7c3aed14', shadow: '#7c3aed33', glow: '#7c3aed40',
    },
  },

  blush: {
    id: 'blush', name: 'Blush', mode: 'light',
    description: 'Soft rose paper with pink accent',
    swatch: ['#fff1f2', '#e11d48'],
    palette: {
      background:      '#fff1f2',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#1f1115',
      onSurface:       '#3f1d24',
      muted:           '#78535b',
      divider:         '#fecdd3',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#fff1f2',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#e11d48', secondary: '#f43f5e', tertiary: '#fb7185',
      gradientFrom: '#be123c', gradientTo: '#e11d48',
      bg: '#e11d48', bgHover: '#be123c',
      text: '#be123c', textHover: '#9f1239',
      onAccent: '#ffffff',
      border: '#e11d484d', softBg: '#e11d4814', shadow: '#e11d4833', glow: '#e11d4840',
    },
  },

  champagne: {
    id: 'champagne', name: 'Champagne', mode: 'light',
    description: 'Cream paper with rich gold',
    swatch: ['#fefce8', '#a16207'],
    palette: {
      background:      '#fefce8',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#1c1611',
      onSurface:       '#44403c',
      muted:           '#78716c',
      divider:         '#fde68a',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#fefce8',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#a16207', secondary: '#ca8a04', tertiary: '#eab308',
      gradientFrom: '#854d0e', gradientTo: '#a16207',
      bg: '#a16207', bgHover: '#854d0e',
      text: '#854d0e', textHover: '#713f12',
      onAccent: '#ffffff',
      border: '#a162074d', softBg: '#a1620714', shadow: '#a1620733', glow: '#a1620740',
    },
  },

  pearl: {
    id: 'pearl', name: 'Pearl', mode: 'light',
    description: 'Pearl white with silver accent',
    swatch: ['#fafafa', '#52525b'],
    palette: {
      background:      '#fafafa',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#09090b',
      onSurface:       '#27272a',
      muted:           '#71717a',
      divider:         '#d4d4d8',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#fafafa',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#52525b', secondary: '#71717a', tertiary: '#a1a1aa',
      gradientFrom: '#3f3f46', gradientTo: '#52525b',
      bg: '#52525b', bgHover: '#3f3f46',
      text: '#3f3f46', textHover: '#27272a',
      onAccent: '#ffffff',
      border: '#52525b4d', softBg: '#52525b14', shadow: '#52525b33', glow: '#52525b40',
    },
  },

  brocade: {
    id: 'brocade', name: 'Brocade', mode: 'light',
    description: 'Cream weave with deep plum',
    swatch: ['#fdf8f0', '#7e2561'],
    palette: {
      background:      '#fdf8f0',
      surface:         '#ffffff',
      surfaceElevated: '#ffffff',
      onBackground:    '#1a0b1a',
      onSurface:       '#3d1a35',
      muted:           '#7a5566',
      divider:         '#e3cd9f',
      overlay:         LIGHT_OVERLAY,
      sheenStart:      'transparent',
      sheenEnd:        'transparent',
      pageEdge:        '#fdf8f0',
      ...LIGHT_STATUS_PALETTE,
    },
    accent: {
      primary: '#7e2561', secondary: '#9a3478', tertiary: '#b04590',
      gradientFrom: '#5a1848', gradientTo: '#7e2561',
      bg: '#7e2561', bgHover: '#5a1848',
      text: '#5a1848', textHover: '#3d1a35',
      onAccent: '#ffffff',
      border: '#7e25614d', softBg: '#7e256114', shadow: '#7e256133', glow: '#7e256140',
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const DEFAULT_THEME: ThemeId = 'midnight';

// ─── Legacy migration ───────────────────────────────────────────────────────
// Old AsyncStorage key 'theme' stored accent names from the 6-accent model.
// Map them to the closest new theme id.

const LEGACY_ACCENT_MAP: Record<string, ThemeId> = {
  default: 'midnight',
  ocean:   'ocean',
  rose:    'rose',
  emerald: 'forest',
  violet:  'obsidian',
  parlour: 'dawn',
};

export function migrateLegacyTheme(value: string | null): ThemeId {
  if (!value) return DEFAULT_THEME;
  if (value in THEMES) return value as ThemeId;
  if (value in LEGACY_ACCENT_MAP) return LEGACY_ACCENT_MAP[value];
  return DEFAULT_THEME;
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES[id] ?? THEMES[DEFAULT_THEME];
}
