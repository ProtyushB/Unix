// ─── Dark Base Palette ───────────────────────────────────────────────────────

export const darkPalette = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  muted: '#64748b',
  text: '#f8fafc',
} as const;

// ─── Accent Theme Shape ──────────────────────────────────────────────────────

export interface AccentTheme {
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
}

// ─── Theme Names ─────────────────────────────────────────────────────────────

export type ThemeName = 'default' | 'ocean' | 'rose' | 'emerald' | 'violet' | 'parlour';

// ─── Theme Definitions ───────────────────────────────────────────────────────

export const themes: Record<ThemeName, AccentTheme> = {
  default: {
    primary: '#f97316',
    secondary: '#fb923c',
    tertiary: '#fdba74',
    gradientFrom: '#f97316',
    gradientTo: '#ea580c',
    bg: '#f97316',
    bgHover: '#ea580c',
    text: '#f97316',
    textHover: '#fb923c',
    border: '#f9731640',
    softBg: '#f9731615',
    shadow: '#f9731630',
    glow: '#f9731650',
  },
  ocean: {
    primary: '#0ea5e9',
    secondary: '#38bdf8',
    tertiary: '#7dd3fc',
    gradientFrom: '#0ea5e9',
    gradientTo: '#0284c7',
    bg: '#0ea5e9',
    bgHover: '#0284c7',
    text: '#0ea5e9',
    textHover: '#38bdf8',
    border: '#0ea5e940',
    softBg: '#0ea5e915',
    shadow: '#0ea5e930',
    glow: '#0ea5e950',
  },
  rose: {
    primary: '#e11d48',
    secondary: '#fb7185',
    tertiary: '#fda4af',
    gradientFrom: '#e11d48',
    gradientTo: '#be123c',
    bg: '#e11d48',
    bgHover: '#be123c',
    text: '#e11d48',
    textHover: '#fb7185',
    border: '#e11d4840',
    softBg: '#e11d4815',
    shadow: '#e11d4830',
    glow: '#e11d4850',
  },
  emerald: {
    primary: '#10b981',
    secondary: '#34d399',
    tertiary: '#6ee7b7',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    bg: '#10b981',
    bgHover: '#059669',
    text: '#10b981',
    textHover: '#34d399',
    border: '#10b98140',
    softBg: '#10b98115',
    shadow: '#10b98130',
    glow: '#10b98150',
  },
  violet: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    tertiary: '#c4b5fd',
    gradientFrom: '#8b5cf6',
    gradientTo: '#7c3aed',
    bg: '#8b5cf6',
    bgHover: '#7c3aed',
    text: '#8b5cf6',
    textHover: '#a78bfa',
    border: '#8b5cf640',
    softBg: '#8b5cf615',
    shadow: '#8b5cf630',
    glow: '#8b5cf650',
  },
  parlour: {
    primary: '#f59e0b',
    secondary: '#fbbf24',
    tertiary: '#fcd34d',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    bg: '#f59e0b',
    bgHover: '#d97706',
    text: '#f59e0b',
    textHover: '#fbbf24',
    border: '#f59e0b40',
    softBg: '#f59e0b15',
    shadow: '#f59e0b30',
    glow: '#f59e0b50',
  },
} as const;

// ─── Helper ──────────────────────────────────────────────────────────────────

export function getTheme(name: ThemeName): AccentTheme {
  return themes[name] ?? themes.default;
}
