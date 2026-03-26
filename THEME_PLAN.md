# Ultimate Theme System Implementation Plan

## Executive Summary

The current theme system is architecturally broken: the app stores a theme preference string but components import colors statically at module load time, so theme switching requires an app restart and changes nothing visually while the app is running. All 37+ components are hardcoded to the orange `themes.default` accent. Navigation is hardcoded. Light mode doesn't exist. Gradients and glows are defined but never used.

The fix is a **hook-first, memoized StyleSheet architecture** — a reactive `ThemeContext` distributes a fully resolved `AppTheme` object, components consume it via `useTheme()` + `useThemedStyles()`, and a pure `buildTheme()` function composes the complete theme from two strings (`mode` + `accentName`). This is the most idiomatic React Native pattern and is incrementally migratable.

---

## Current State: Critical Failures

| Issue | Severity | Root Cause |
|---|---|---|
| Theme switching has no effect on UI | Critical | Static color imports — no reactivity |
| Navigation always orange | Critical | `themes.default.primary` hardcoded in 3 navigators |
| 40+ hardcoded hex values in components | Critical | No enforced convention for consuming colors |
| No light mode | Major | Only `darkPalette` defined |
| Gradients/glows unused | Major | No LinearGradient usage, no shadow system |
| Status colors outside theme | Moderate | Separate `statusColors.ts` disconnected from theme |
| Avatar colors outside theme | Moderate | Local hash palette in `AvatarBadge` |
| Typography/spacing tokens bypassed | Minor | Hardcoded px values instead of `spacing.*` |

---

## 1. New File Structure

```
src/
  theme/
    colors.ts           MODIFIED  — add lightPalette, keep darkPalette + 6 accents
    typography.ts       UNCHANGED
    spacing.ts          UNCHANGED
    tokens.ts           NEW       — status colors (expanded), avatar pools, semantic tokens
    shapes.ts           NEW       — elevation levels, glow/shadow system
    theme.types.ts      NEW       — all TypeScript interfaces
    buildTheme.ts       NEW       — pure composition function (no React)
    themes.ts           NEW       — pre-built theme map
    index.ts            MODIFIED  — updated barrel exports
  context/
    ThemeContext.tsx    NEW       — provider + AsyncStorage + context split
    AppContext.tsx      MODIFIED  — remove theme state, delegate to ThemeContext
  hooks/
    useTheme.ts         NEW       — primary consumer hook
    useThemedStyles.ts  NEW       — memoized style factory hook
    useNavigationTheme.ts NEW     — maps AppTheme → NavigationTheme shape
  utils/
    statusColors.ts     DELETED   — absorbed into tokens.ts + theme.status
```

---

## 2. Complete `AppTheme` Object Shape

This is what `useTheme()` returns. Every component uses this — no direct imports from `colors.ts`.

```typescript
interface AppTheme {
  name: AccentName;   // 'default' | 'ocean' | 'rose' | 'emerald' | 'violet' | 'parlour'
  mode: ThemeMode;    // 'dark' | 'light'

  // Accent-driven colors (change with accent selection)
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

  // Mode-driven base palette (change with dark/light mode)
  palette: {
    background: string;      // screen background
    surface: string;         // card / sheet background
    surfaceElevated: string; // modal / overlay background
    onBackground: string;    // primary text on background
    onSurface: string;       // secondary text on surface
    muted: string;           // disabled / placeholder text
    divider: string;         // subtle separators
    overlay: string;         // scrim behind modals
    error: string;
    warning: string;
    success: string;
    info: string;
  };

  // Status system — fully integrated, replaces statusColors.ts
  status: {
    active:         { bg: string; text: string; border: string };
    pending:        { bg: string; text: string; border: string };
    confirmed:      { bg: string; text: string; border: string };
    completed:      { bg: string; text: string; border: string };
    cancelled:      { bg: string; text: string; border: string };
    inactive:       { bg: string; text: string; border: string };
    paid:           { bg: string; text: string; border: string };
    unpaid:         { bg: string; text: string; border: string };
    partiallyPaid:  { bg: string; text: string; border: string };
    scheduled:      { bg: string; text: string; border: string };
    expired:        { bg: string; text: string; border: string };
    onHold:         { bg: string; text: string; border: string };
    quarantined:    { bg: string; text: string; border: string };
    depleted:       { bg: string; text: string; border: string };
  };

  // Avatar color pool — integrated, replaces local hash logic in AvatarBadge
  avatar: {
    pools: Array<{ bg: string; text: string }>;
    forName: (name: string) => { bg: string; text: string }; // deterministic hash
  };

  // Ready-to-use gradient configs (pass directly to LinearGradient)
  gradients: {
    primary: { colors: string[]; start: Point; end: Point };
    surface: { colors: string[]; start: Point; end: Point };
    hero:    { colors: string[]; start: Point; end: Point };
  };

  // Elevation + glow system (platform-aware, computed in buildTheme)
  elevation: {
    none:   ViewStyle;
    low:    ViewStyle;
    medium: ViewStyle;
    high:   ViewStyle;
    glow:   ViewStyle;  // uses theme.colors.glow
  };

  // Pass-throughs (already well-structured)
  typography: typeof typography;
  spacing: typeof spacing;
}
```

**Design principle**: `palette` is mode-driven. `colors` is accent-driven. They are orthogonal axes — switching accent doesn't affect surface colors, switching mode doesn't affect the accent hue.

---

## 3. `buildTheme.ts` — Pure Composition Engine

```typescript
// Pure function — no React, no side effects, fully testable
export function buildTheme(mode: ThemeMode, accentName: AccentName): AppTheme
```

This function:
- Selects the appropriate base palette (`darkPalette` or `lightPalette`) by `mode`
- Selects the accent definition from `colors.ts` by `accentName`
- Expands each status to a full `{ bg, text, border }` triple (border = bg at 25% opacity, text = white on dark, near-black on light)
- Builds `gradients.primary` from `gradientFrom`/`gradientTo`, `gradients.surface` from subtle palette variants, `gradients.hero` from a three-stop palette blend
- Builds `elevation` levels using platform-appropriate shadow styles; `elevation.glow` uses `theme.colors.glow` as `shadowColor` on iOS and `react-native-shadow-2` on Android
- Provides `avatar.forName(name)` as a closure over the pools array using a simple djb2 hash to a stable index
- Returns a frozen object (no mutations in consumers)

Write unit tests for `buildTheme` — it has no React dependencies so it's trivial to test all 12 theme combinations (6 accents × 2 modes).

---

## 4. `ThemeContext.tsx` — Reactive Provider

**State held**: `{ mode: ThemeMode, accentName: AccentName }` — two strings only, not the full theme object.

**Theme object derivation**: `useMemo(() => buildTheme(mode, accentName), [mode, accentName])` — reference only changes when a string changes.

**Context split** (prevents unnecessary re-renders):
- `ThemeContext` — holds the `AppTheme` object. All 37+ components subscribe to this.
- `ThemeActionsContext` — holds `{ setAccent, setMode, toggleMode }`. Only the settings screen subscribes to this.

**Persistence**:
```
mount → Promise.all([getItem('@theme_accent'), getItem('@theme_mode_override')])
      → apply stored values (or system default)
      → set ready: true → render children
```

Until `ready` is true, render `null` (splash screen continuation, no theme flash).

On `setAccent`/`setMode`: update React state synchronously (instant re-render), write to AsyncStorage asynchronously in background (no await blocks UI).

**System preference**: On first launch (no stored `@theme_mode_override`), read `useColorScheme()` and default to system. After any explicit user mode change, store `'user'` as the override sentinel and ignore system preference.

**Provider placement**: Wrap at app root, above `NavigationContainer`. Required so navigation can consume the theme.

---

## 5. `useTheme` and `useThemedStyles` Hooks

### `useTheme`

```typescript
// src/hooks/useTheme.ts
export function useTheme(): AppTheme
```

Single hook. Reads from `ThemeContext`. Throws a descriptive error if used outside the provider. No optional chaining — the provider guarantees a value.

### `useThemedStyles`

```typescript
// src/hooks/useThemedStyles.ts
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T
): T
```

Internally: `useMemo(() => StyleSheet.create(factory(theme)), [theme])`.

`StyleSheet.create` inside `useMemo` is the correct balance: native registration happens once per theme switch (not once per render), and styles update when the theme actually changes.

---

## 6. Component Convention — The Definitive Pattern

Every component after migration follows this exact structure:

```typescript
// ComponentName.tsx
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../hooks/useTheme';

export function ComponentName({ variant, disabled }: Props) {
  // useTheme() directly: only for values that can't go in StyleSheet
  // (gradient colors arrays, animated values, third-party component props)
  const { gradients, avatar } = useTheme();

  // useThemedStyles: for all StyleSheet styles
  const styles = useThemedStyles((theme) => createStyles(theme, { variant, disabled }));

  return (
    <LinearGradient {...gradients.primary}>
      <Text style={styles.label}>...</Text>
    </LinearGradient>
  );
}

// Module-level — no closure over component state or props
// Receives theme + props as parameters
function createStyles(theme: AppTheme, props: { variant: Variant; disabled: boolean }) {
  return StyleSheet.create({
    container: {
      backgroundColor: props.disabled
        ? theme.palette.muted
        : theme.colors.softBg,
      borderRadius: theme.spacing.borderRadius.md,
      ...theme.elevation.medium,
    },
    label: {
      ...theme.typography.textStyles.label,
      color: theme.palette.onBackground,
    },
  });
}
```

**Rules**:
1. `createStyles` is always module-level. No inline `StyleSheet.create` inside components.
2. `useThemedStyles(factory)` handles memoization. Do not manually `useMemo` inside components.
3. Use `useTheme()` directly only for values that StyleSheet cannot accept (gradient arrays, shadow configs for third-party components, values passed as props).
4. Never import directly from `src/theme/colors.ts` in any component. All color access through `useTheme()`.
5. No hardcoded hex values. If a hex is needed, add it to `tokens.ts` first.

---

## 7. Navigation Integration

**`NavigationContainer` theme prop**:

```typescript
// useNavigationTheme.ts
export function useNavigationTheme(): NavigationTheme {
  const { theme } = useContext(ThemeContext);
  return useMemo(() => ({
    dark: theme.mode === 'dark',
    colors: {
      primary: theme.colors.primary,
      background: theme.palette.background,
      card: theme.palette.surface,
      text: theme.palette.onBackground,
      border: theme.colors.border,
      notification: theme.colors.primary,
    }
  }), [theme]);
}
```

Used in `RootNavigator`:
```typescript
const navTheme = useNavigationTheme();
<NavigationContainer theme={navTheme}>
```

**Tab navigators**: `screenOptions` accepts a function — hooks are valid inside it during render. Switch from `tabBarActiveTintColor: themes.default.primary` to:
```typescript
screenOptions: () => {
  const { colors, palette } = useTheme();
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: palette.muted,
    tabBarStyle: { backgroundColor: palette.surface },
  };
}
```

**Result**: Navigation chrome reacts to theme changes instantly. No hardcoded orange anywhere in navigation.

---

## 8. Light Mode

**Decision: Define now, toggle later.** The `palette` split (mode-driven vs accent-driven) is a foundational architecture decision — retrofitting light mode after component migration would require revisiting every component. Since we're doing a full migration anyway, the marginal cost of defining `lightPalette` is minimal.

**`lightPalette`**:
```
background:      #F8F9FA   (near-white)
surface:         #FFFFFF   (white)
surfaceElevated: #F0F2F5   (slightly gray, modals)
onBackground:    #111827   (near-black)
onSurface:       #374151   (dark gray)
muted:           #9CA3AF   (medium gray)
divider:         #E5E7EB   (light gray)
overlay:         rgba(0,0,0,0.4)
error:           #DC2626
warning:         #D97706
success:         #059669
info:            #2563EB
```

Accent `primary` colors in light mode get a 15% darken adjustment for WCAG AA compliance on white backgrounds.

**Rollout**: Ship dark mode fully working. Light mode palette is in the code from day one but the UI toggle is behind a feature flag. This avoids shipping half-baked light mode while ensuring no architectural rework is needed when it ships.

---

## 9. Status Colors — Integration

Current `statusColors.ts` maps status strings to a single hex. The upgrade expands each to a full triple.

**New shape** (in `tokens.ts`):
```typescript
const darkStatusTokens = {
  active:        { bg: '#10b981', text: '#fff', border: '#10b98140' },
  paid:          { bg: '#10b981', text: '#fff', border: '#10b98140' },
  completed:     { bg: '#10b981', text: '#fff', border: '#10b98140' },
  pending:       { bg: '#f59e0b', text: '#fff', border: '#f59e0b40' },
  scheduled:     { bg: '#f59e0b', text: '#fff', border: '#f59e0b40' },
  confirmed:     { bg: '#f59e0b', text: '#fff', border: '#f59e0b40' },
  cancelled:     { bg: '#ef4444', text: '#fff', border: '#ef444440' },
  expired:       { bg: '#ef4444', text: '#fff', border: '#ef444440' },
  depleted:      { bg: '#ef4444', text: '#fff', border: '#ef444440' },
  onHold:        { bg: '#64748b', text: '#fff', border: '#64748b40' },
  quarantined:   { bg: '#64748b', text: '#fff', border: '#64748b40' },
  unpaid:        { bg: '#f97316', text: '#fff', border: '#f9731640' },
  partiallyPaid: { bg: '#f97316', text: '#fff', border: '#f9731640' },
  inactive:      { bg: '#64748b', text: '#fff', border: '#64748b40' },
};
```

`buildTheme` includes `theme.status`. `StatusPill` reads `theme.status[statusKey]`. `statusColors.ts` is deleted after all consumers are migrated.

---

## 10. Avatar Colors — Integration

**New shape** (in `tokens.ts`):
```typescript
const avatarPools: Array<{ bg: string; text: string }> = [
  { bg: '#f97316', text: '#fff' },  // orange
  { bg: '#0ea5e9', text: '#fff' },  // sky
  { bg: '#10b981', text: '#fff' },  // emerald
  { bg: '#8b5cf6', text: '#fff' },  // violet
  { bg: '#e11d48', text: '#fff' },  // rose
  { bg: '#f59e0b', text: '#111' },  // amber (dark text for contrast)
  { bg: '#14b8a6', text: '#fff' },  // teal
  { bg: '#6366f1', text: '#fff' },  // indigo
];
```

`buildTheme` provides `theme.avatar.forName(name)` using djb2 hash → stable index. `AvatarBadge` calls `const { bg, text } = theme.avatar.forName(person.name)` — no local palette, no local logic.

---

## 11. Gradients — Implementation

Requires `react-native-linear-gradient` (already in most bare RN projects — check `package.json`).

**Pre-built configs from `buildTheme`**:
```typescript
gradients: {
  primary: {
    colors: [theme.colors.gradientFrom, theme.colors.gradientTo],
    start: { x: 0, y: 0 },
    end:   { x: 1, y: 1 },
  },
  surface: {
    colors: [theme.palette.surface, theme.palette.surfaceElevated],
    start: { x: 0, y: 0 },
    end:   { x: 0, y: 1 },
  },
  hero: {
    colors: [theme.colors.gradientFrom, theme.colors.bg, theme.palette.background],
    start: { x: 0, y: 0 },
    end:   { x: 0, y: 1 },
  },
}
```

**Components that use gradients**:
- `AppButton` (primary variant) — `gradients.primary` background
- `FAB` — `gradients.primary` background
- `AppointmentCard`, `BusinessCard` — `gradients.hero` overlay on image
- `ScreenWrapper` (optional) — very subtle `gradients.surface`

Usage:
```typescript
const { gradients } = useTheme();
<LinearGradient {...gradients.primary} style={styles.button}>
```

---

## 12. Glow / Elevation System

**Elevation levels** (computed in `buildTheme` using `Platform.select`):

```typescript
elevation: {
  none:   {},
  low:    Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }, android: { elevation: 2 } }),
  medium: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 }, android: { elevation: 6 } }),
  high:   Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 }, android: { elevation: 12 } }),
  glow:   Platform.select({ ios: { shadowColor: theme.colors.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12 }, android: { elevation: 8 } }),
}
```

On Android, colored glow requires `react-native-shadow-2` for pixel-accurate results matching iOS. Install it and use conditionally in `buildTheme` for `elevation.glow` only.

**Where glow is used**:
- Active tab indicator
- Selected state on cards
- Primary button pressed/active state
- Online status dot on `AvatarBadge`

---

## 13. Performance Strategy

**Why the chain is efficient**:

```
ThemeProvider state: { mode: string, accentName: string }
    ↓ useMemo([mode, accentName])
buildTheme(mode, accentName) → AppTheme (reference stable)
    ↓ ThemeContext.Provider value={theme}
Consumer calls useTheme() → gets same reference unless theme changed
    ↓ useThemedStyles((theme) => createStyles(theme), [theme])
StyleSheet.create() → runs only when theme reference changes
```

A theme switch causes exactly one pass of re-renders through all consumers, generates new StyleSheet objects once, and produces no further renders. This is optimal.

**Context split prevents cascading re-renders**: Components reading display data subscribe to `ThemeContext`. Only the settings screen subscribes to `ThemeActionsContext`. Action setter re-creation (on provider re-render) doesn't cascade to 37+ display components.

**AsyncStorage write is fire-and-forget**: `setState` fires synchronously → instant UI update. `AsyncStorage.setItem` fires asynchronously in the background. No await. No spinner. No delay.

**`ready` gate prevents theme flash**: Provider renders `null` until AsyncStorage reads complete. Users see splash/loading continuation, not a flash from default to stored theme.

---

## 14. Phase-by-Phase Migration Plan

### Phase 0 — Foundation (no component changes)

Build the entire new architecture without touching any existing component. At the end, theme switching works for navigation; all other components still use static imports (no regressions).

**Deliverables**:
- `theme.types.ts` — all TypeScript interfaces (start here, everything else depends on this)
- `tokens.ts` — expanded status colors, avatar pools, semantic constants
- `shapes.ts` — elevation system
- `colors.ts` — add `lightPalette`, keep backward-compatible exports
- `buildTheme.ts` — pure function + unit tests
- `themes.ts` — pre-built theme map
- `ThemeContext.tsx` — provider with AsyncStorage integration + context split
- `useTheme.ts`, `useThemedStyles.ts`, `useNavigationTheme.ts`
- Wire `ThemeProvider` at app root above `NavigationContainer`
- Wire `useNavigationTheme()` into `NavigationContainer`

---

### Phase 1 — Navigation and Layout Chrome (high visibility)

Migration targets: components that form the persistent frame around every screen.

| Component | Key changes |
|---|---|
| `RootNavigator` | Remove hardcoded orange. Use `useNavigationTheme()`. |
| `OwnerTabNavigator` | `screenOptions` uses `useTheme()` for `tabBarActiveTintColor`, `tabBarStyle` |
| `CustomerTabNavigator` | Same as above |
| `ScreenWrapper` | `palette.background` via `useThemedStyles`. Optional subtle gradient. |
| `TopTabBar` | Active pill → `colors.primary`. Inactive → `palette.muted`. |

**Result**: Switching theme produces immediate visible changes to all navigation chrome and screen backgrounds.

---

### Phase 2 — Common Components (highest leverage)

These components are used everywhere — migrating them fixes most screens automatically.

**Priority order**:

| Component | Key changes |
|---|---|
| `AppButton` | Gradient primary variant. Danger → `palette.error`. Secondary → `palette.surface`. |
| `AppCard` | Surface color, border, `elevation.low` |
| `AppInput` | Focus border → `colors.primary`. Error → `palette.error`. |
| `StatusPill` | Reads `theme.status[statusKey]`. Delete `statusColors.ts` dependency. |
| `AvatarBadge` | `theme.avatar.forName(name)`. Delete local palette. |
| `Toast` | Success/error/info from `palette.success/error/info` |
| `ConfirmDialog` | Surface, confirm button → `colors.primary`, cancel → `palette.muted` |
| `ErrorBanner` / `ErrorState` | `palette.error` replaces `#ef4444` |
| `EmptyState` | `palette.muted`, `palette.onSurface` |
| `LoadingSpinner` | `colors.primary` |
| `SectionHeader` | `palette.onBackground`, action link → `colors.primary` |
| `PortalSwitcherSheet` | Full surface + accent migration |
| `BiometricOnboardingModal` | Full audit + migration |
| `FAB` | Gradient background, `elevation.glow` |

---

### Phase 3 — Form Components

Interactive components where focus/active states expose broken orange hardcoding most visibly.

| Component | Key changes |
|---|---|
| `OtpInput` | Active border → `colors.primary`. Inactive → `palette.divider`. |
| `PasswordInput` | Via `AppInput` (already done in Phase 2) |
| `PasswordChecklist` | Check icon → `palette.success`. Fail → `palette.error`. |
| `ProgressBar` | Fill → `colors.primary`. Track → `palette.surface`. |
| `SelectField` | Dropdown surface, selected item → `colors.softBg` + `colors.primary` border |
| `StepProgress` | Active → `colors.primary`. Completed → `palette.success`. |

---

### Phase 4 — List and Card Components

Data display — what users look at most. Gradients on image overlays deployed here.

| Component | Key changes |
|---|---|
| `AppointmentCard` | `gradients.hero` over image. Status from `theme.status`. |
| `BillCard` | Surface, amount text → `colors.primary` |
| `BusinessCard` | Hero gradient overlay. Surface via `palette`. |
| `InventoryBatchCard` | Status integration |
| `OrderCard` | Status integration. CTA → `colors.primary`. |
| `PersonCard` | Avatar via `theme.avatar.forName()`. |
| `ProductCard` | Surface, price → `colors.primary` |
| `ServiceCard` | Accent color, surface |

---

### Phase 5 — Media and Remaining Components

| Component | Key changes |
|---|---|
| `DmsImage` | Placeholder → `palette.surface` |
| `ImageGallery` | Overlay, controls → theme values |
| `BusinessSelector` | Surface, selected → `colors.softBg` |
| Any remaining | Full audit, remove all static imports |

**Cleanup**:
- Delete `src/utils/statusColors.ts`
- Remove backward-compat exports from `colors.ts` (any that were only for component imports)
- Search for `#[0-9a-fA-F]{3,6}` in `src/components/**` — fix every hit
- Enable TypeScript strict mode on theme files
- Add ESLint `no-restricted-imports` rule: no importing from `src/theme/colors.ts` in component files

---

### Phase 6 — Light Mode and Polish

**Deliverables**:
- Complete `lightPalette` validation — test every component visually in light mode
- Define `lightStatusColors` for better contrast on white backgrounds
- UI toggle in settings screen (mode switch + accent picker, already has accent picker)
- `useColorScheme()` integration for system preference detection
- Verify all 12 combinations (6 accents × 2 modes) render correctly
- WCAG AA contrast audit — every text/background combo in every theme

---

### Phase 7 — Hardening

**Deliverables**:
- ESLint rule enforcing no direct `colors.ts` imports in components — catches regressions at CI time
- Integration tests for `ThemeProvider` (accent switch, mode switch, AsyncStorage writes, consumer re-renders)
- `ThemePreview` developer screen — all tokens, all components, all themes side-by-side
- Document the `createStyles` convention in contribution guide
- Process for adding new accent themes: one entry in `colors.ts`, `buildTheme` handles the rest, zero component changes needed

---

## Checklist Summary

### Architecture
- [ ] `theme.types.ts` — all interfaces
- [ ] `tokens.ts` — status, avatar, semantics
- [ ] `shapes.ts` — elevation, glow
- [ ] `colors.ts` — add `lightPalette`
- [ ] `buildTheme.ts` — pure function + tests
- [ ] `ThemeContext.tsx` — provider + split contexts + AsyncStorage
- [ ] `useTheme.ts`, `useThemedStyles.ts`, `useNavigationTheme.ts`
- [ ] Wire provider at app root

### Navigation
- [ ] `RootNavigator` — `useNavigationTheme()`
- [ ] `OwnerTabNavigator` — `useTheme()` in `screenOptions`
- [ ] `CustomerTabNavigator` — `useTheme()` in `screenOptions`

### Components
- [ ] Phase 1: `ScreenWrapper`, `TopTabBar`
- [ ] Phase 2: All 14 common components
- [ ] Phase 3: All 6 form components
- [ ] Phase 4: All 8 list/card components
- [ ] Phase 5: Media + remaining

### Cleanup
- [ ] Delete `statusColors.ts`
- [ ] No hex literals in components (grep verified)
- [ ] No direct `colors.ts` imports in components (ESLint enforced)

### Light Mode
- [ ] `lightPalette` defined
- [ ] `lightStatusColors` defined
- [ ] `buildTheme` handles both modes
- [ ] UI toggle in settings
- [ ] System preference detection

### Quality
- [ ] Unit tests for `buildTheme`
- [ ] Integration tests for `ThemeProvider`
- [ ] WCAG AA contrast audit (all 12 combinations)
- [ ] `ThemePreview` developer screen
- [ ] ESLint rule for import enforcement
