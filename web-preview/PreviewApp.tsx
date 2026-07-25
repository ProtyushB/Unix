import 'react-native-get-random-values'; // crypto polyfill the app relies on (uuid)
import React, { Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../src/hooks/useTheme';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AppProvider } from '../src/context/AppContext';
import { SignupDraftProvider } from '../src/context/SignupDraftContext';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { REGISTRY, lazyScreen, type ScreenEntry } from './registry';

// Sentinel id for the "run the whole app" mode (real RootNavigator + live nav).
const LIVE_APP = '__live_app__';

// ─── Device presets ──────────────────────────────────────────────────────────

interface Device { name: string; w: number; h: number; top: number; bottom: number; }

const DEVICES: Record<string, Device> = {
  iphone13: { name: 'iPhone 13', w: 390, h: 844, top: 47, bottom: 34 },
  pixel5:   { name: 'Pixel 5', w: 393, h: 851, top: 24, bottom: 0 },
  small:    { name: 'Small', w: 360, h: 640, top: 24, bottom: 0 },
  tablet:   { name: 'Tablet', w: 768, h: 1024, top: 24, bottom: 0 },
};

// Closed select shows just the name (compact); the open list adds dimensions.
const deviceLabel = (d: Device, withDims: boolean) =>
  withDims ? `${d.name} · ${d.w}×${d.h}` : d.name;

// ─── Themes (ids from src/theme/colors.ts) ───────────────────────────────────

const THEMES: { id: string; label: string }[] = [
  { id: 'midnight', label: 'Midnight' }, { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' }, { id: 'obsidian', label: 'Obsidian' },
  { id: 'rose', label: 'Rose' }, { id: 'gilded', label: 'Gilded' },
  { id: 'onyx', label: 'Onyx' }, { id: 'banarasi', label: 'Banarasi' },
  { id: 'dawn', label: 'Dawn' }, { id: 'sky', label: 'Sky' },
  { id: 'sage', label: 'Sage' }, { id: 'lavender', label: 'Lavender' },
  { id: 'blush', label: 'Blush' }, { id: 'champagne', label: 'Champagne' },
  { id: 'pearl', label: 'Pearl' }, { id: 'brocade', label: 'Brocade' },
];

const Stack = createNativeStackNavigator();

// The navigator lives inside ThemeProvider so it can paint the scene background
// with the active app theme — otherwise React Navigation's DefaultTheme shows a
// light-gray (#f2f2f2) backdrop through safe-area regions on dark themes.
function ThemedNavigator({ entry, Screen }: { entry: ScreenEntry; Screen: React.ComponentType<any> }) {
  const { colors, palette, mode } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: mode === 'dark',
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.onBackground,
      border: palette.divider,
      notification: colors.primary,
    },
  };
  return (
    <NavigationContainer theme={navTheme} documentTitle={{ enabled: false }}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name={entry.id} component={Screen} initialParams={entry.params} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Error boundary ──────────────────────────────────────────────────────────

class ScreenBoundary extends React.Component<
  { children: ReactNode; onError?: (e: Error) => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { this.props.onError?.(error); }
  render() {
    if (this.state.error) {
      return (
        <div style={styles.crash}>
          <div style={styles.crashTitle}>This screen threw while rendering</div>
          <pre style={styles.crashMsg}>{String(this.state.error?.stack || this.state.error?.message)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Stage: the phone-framed screen + all providers it needs ─────────────────

function deviceMetrics(device: Device): Metrics {
  return {
    frame: { x: 0, y: 0, width: device.w, height: device.h },
    insets: { top: device.top, left: 0, right: 0, bottom: device.bottom },
  };
}

// Runs the REAL app — the same provider stack as App.tsx wrapped around the
// actual RootNavigator, so you get live navigation, the auth flow, and the tab
// navigators. (RootNavigator supplies its own NavigationContainer, so we must
// NOT add ThemedNavigator here.) Native-only actions no-op on web; API calls
// depend on the backend allowing the localhost origin (CORS).
function LiveApp({ device }: { device: Device }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={deviceMetrics(device)}>
        <ThemeProvider>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Stage({ entry, device }: { entry: ScreenEntry; device: Device }) {
  const Screen = useMemo(() => lazyScreen(entry), [entry]);

  const metrics = deviceMetrics(device);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <AppProvider>
            <SignupDraftProvider>
              <ThemedNavigator entry={entry} Screen={Screen} />
            </SignupDraftProvider>
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ─── Harness chrome ──────────────────────────────────────────────────────────

export function PreviewApp() {
  const [selectedId, setSelectedId] = useState(REGISTRY[0]?.id ?? '');
  const [deviceKey, setDeviceKey] = useState('iphone13');
  const [themeId, setThemeId] = useState('midnight');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [errored, setErrored] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);

  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const canvasRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });

  const isLive = selectedId === LIVE_APP;
  const entry = REGISTRY.find(e => e.id === selectedId);
  const device = DEVICES[deviceKey];

  // Track the canvas size so "Fit" can shrink the frame to whatever space is
  // available (the browser pane is often shorter than an 844px phone).
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setAvail(prev => {
      const w = el.clientWidth, h = el.clientHeight;
      return prev.w === w && prev.h === h ? prev : { w, h };
    });
    measure();
    // A single sync measure can fire before flex heights / the RN-web mount
    // settle (leaving a too-small value that never self-corrects without a
    // resize). Re-measure across the next frames, and keep a window-resize
    // fallback in case the ResizeObserver is slow to fire.
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 400);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Must equal the canvas padding on both sides (2 × 16) so the fitted device
  // exactly fills the padded content box — otherwise it overflows and scrolls.
  const MARGIN = 32;
  // No upscale cap: Fit grows the device to fill whichever dimension is tighter,
  // so any device (small phone, tablet) fills the workspace instead of floating
  // small in it. Fitting the tighter axis keeps both axes on-screen (no scroll).
  const fitScale = Math.min(
    (avail.w - MARGIN) / device.w,
    (avail.h - MARGIN) / device.h,
  );
  const scale = zoom === 'fit' ? (avail.w ? Math.max(fitScale, 0.1) : 1) : zoom;

  // Volume-style zoom controls.
  const ZMIN = 0.25;
  const ZMAX = 2;
  const clampZoom = (z: number) => Math.min(ZMAX, Math.max(ZMIN, Math.round(z * 100) / 100));
  // Functional updater so rapid clicks each build on the latest value (not a
  // stale render closure). From "fit" the first step anchors on the live scale.
  const stepZoom = (delta: number) =>
    setZoom(prev => clampZoom((prev === 'fit' ? scale : prev) + delta));

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = REGISTRY.filter(e =>
      !q || e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
    const byGroup: Record<string, ScreenEntry[]> = {};
    for (const e of filtered) (byGroup[e.group] ??= []).push(e);
    return byGroup;
  }, [search]);

  async function changeTheme(id: string) {
    await AsyncStorage.setItem('theme', id); // ThemeProvider re-reads this on mount
    setThemeId(id);
    setReloadKey(k => k + 1);
  }

  // Remount the whole Stage on any of these so screen state / theme reset cleanly.
  const stageKey = `${selectedId}-${themeId}-${deviceKey}-${reloadKey}`;

  // The same controls, laid out horizontally in the top bar (sidebar open) or
  // stacked vertically inside the collapsed sidebar.
  const renderControls = (vertical: boolean) => (
    <div style={vertical ? styles.controlsV : styles.controls}>
      <label style={styles.ctrlLabel}>Device</label>
      <select
        style={vertical ? styles.selectV : styles.select}
        value={deviceKey}
        onChange={e => { setDeviceKey(e.target.value); setDeviceMenuOpen(false); }}
        onMouseDown={() => setDeviceMenuOpen(true)}
        onFocus={() => setDeviceMenuOpen(true)}
        onBlur={() => setDeviceMenuOpen(false)}
      >
        {Object.entries(DEVICES).map(([k, d]) => (
          <option key={k} value={k}>{deviceLabel(d, deviceMenuOpen)}</option>
        ))}
      </select>
      <label style={styles.ctrlLabel}>Theme</label>
      <select style={vertical ? styles.selectV : styles.select} value={themeId} onChange={e => changeTheme(e.target.value)}>
        {THEMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <label style={styles.ctrlLabel}>Zoom</label>
      {vertical ? (
        // Vertical stack (top = zoom in) so the collapsed rail can stay narrow.
        <div style={styles.zoomBarV}>
          <button
            onClick={() => setZoom('fit')}
            style={{ ...styles.zoomFit, ...(zoom === 'fit' ? styles.zoomFitActive : null) }}
            title="Auto-fit to pane"
          >
            Fit
          </button>
          <button onClick={() => stepZoom(0.1)} style={styles.zoomBtn} title="Zoom in">+</button>
          <input
            type="range"
            min={ZMIN}
            max={ZMAX}
            step={0.05}
            value={scale}
            onChange={e => setZoom(clampZoom(Number(e.target.value)))}
            style={styles.zoomSliderV}
            title={`${Math.round(scale * 100)}%`}
          />
          <button onClick={() => stepZoom(-0.1)} style={styles.zoomBtn} title="Zoom out">−</button>
          <span style={styles.zoomVal}>{Math.round(scale * 100)}%</span>
        </div>
      ) : (
        <div style={styles.zoomBar}>
          <button
            onClick={() => setZoom('fit')}
            style={{ ...styles.zoomFit, ...(zoom === 'fit' ? styles.zoomFitActive : null) }}
            title="Auto-fit to pane"
          >
            Fit
          </button>
          <button onClick={() => stepZoom(-0.1)} style={styles.zoomBtn} title="Zoom out">−</button>
          <input
            type="range"
            min={ZMIN}
            max={ZMAX}
            step={0.05}
            value={scale}
            onChange={e => setZoom(clampZoom(Number(e.target.value)))}
            style={styles.zoomSlider}
            title={`${Math.round(scale * 100)}%`}
          />
          <button onClick={() => stepZoom(0.1)} style={styles.zoomBtn} title="Zoom in">+</button>
          <span style={styles.zoomVal}>{Math.round(scale * 100)}%</span>
        </div>
      )}
      <button style={vertical ? styles.reloadV : styles.reload} onClick={() => setReloadKey(k => k + 1)}>↻ Reload</button>
    </div>
  );

  return (
    <div style={styles.app}>
      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 280 : 'fit-content', minWidth: sidebarOpen ? undefined : 92 }}>
        <div style={{ ...styles.sidebarHeader, justifyContent: sidebarOpen ? 'space-between' : 'flex-end' }}>
          {sidebarOpen && <span style={styles.brand}>Unix · Screen Preview</span>}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={styles.collapseBtn}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '«' : '»'}
          </button>
        </div>
        {!sidebarOpen && renderControls(true)}
        {sidebarOpen && (
        <input
          style={styles.search}
          placeholder="Search screens…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        )}
        {sidebarOpen && (
        <div style={styles.list}>
          <button
            onClick={() => setSelectedId(LIVE_APP)}
            style={{ ...styles.liveItem, ...(isLive ? styles.itemActive : null) }}
          >
            ▶ Live App <span style={styles.liveHint}>full navigation</span>
          </button>
          {Object.entries(groups).map(([group, entries]) => (
            <div key={group}>
              <div style={styles.groupLabel}>{group}</div>
              {entries.map(e => {
                const active = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    style={{ ...styles.item, ...(active ? styles.itemActive : null) }}
                  >
                    <span>{e.title}</span>
                    {errored[e.id] && <span style={styles.badge}>err</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        )}
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.topbar}>
          {/* Redundant with the sidebar's highlighted item when it's open —
              only show the current screen name when the sidebar is collapsed. */}
          <div style={styles.topTitle}>
            {sidebarOpen ? '' : (isLive ? '▶ Live App' : (entry?.title ?? 'No screen'))}
          </div>
          {/* Controls live in the top bar only while the sidebar is open;
              when collapsed they move into the sidebar (stacked vertically). */}
          {sidebarOpen && renderControls(false)}
        </header>

        <div style={styles.canvas} ref={canvasRef}>
          {entry || isLive ? (
            // Outer box reserves the *scaled* footprint so the frame stays
            // centered and the canvas never overflows; the inner phone renders
            // at true device pixels and is visually scaled (screens still lay
            // out at real device dimensions).
            <div style={{ width: device.w * scale, height: device.h * scale, flexShrink: 0 }}>
              <div
                style={{
                  ...styles.phone,
                  width: device.w,
                  height: device.h,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <ScreenBoundary
                  key={stageKey}
                  onError={() => setErrored(m => ({ ...m, [selectedId]: true }))}
                >
                  <Suspense fallback={<div style={styles.loading}>Loading…</div>}>
                    {isLive
                      ? <LiveApp device={device} />
                      : <Stage entry={entry!} device={device} />}
                  </Suspense>
                </ScreenBoundary>
              </div>
            </div>
          ) : (
            <div style={styles.loading}>Pick a screen from the left.</div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Styles (plain CSS objects — this chrome is DOM, not RN) ──────────────────

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', color: '#e5e7eb' },
  sidebar: { width: 280, flexShrink: 0, background: '#0f1115', borderRight: '1px solid #1f2430', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', transition: 'width 0.18s ease' },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 8px 10px 16px', borderBottom: '1px solid #1f2430', minHeight: 52 },
  brand: { fontSize: 14, fontWeight: 700, letterSpacing: 0.3, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  collapseBtn: { width: 30, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#161a22', border: '1px solid #262c3a', borderRadius: 8, color: '#e5e7eb', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: 0 },
  search: { margin: 12, padding: '8px 10px', background: '#161a22', border: '1px solid #262c3a', borderRadius: 8, color: '#e5e7eb', fontSize: 13, outline: 'none' },
  list: { overflowY: 'auto', flex: 1, padding: '0 8px 16px' },
  groupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#6b7280', padding: '12px 8px 4px' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 8, color: '#cbd5e1', fontSize: 13, cursor: 'pointer' },
  itemActive: { background: '#1d4ed8', color: '#fff' },
  liveItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '10px', margin: '4px 0 8px', background: '#132a1a', border: '1px solid #1f5133', borderRadius: 8, color: '#86efac', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  liveHint: { fontSize: 10, fontWeight: 400, color: '#6b7280' },
  badge: { fontSize: 10, background: '#7f1d1d', color: '#fecaca', padding: '1px 6px', borderRadius: 6 },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0c10' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '10px 16px', borderBottom: '1px solid #1f2430', background: '#0f1115' },
  topTitle: { fontSize: 14, fontWeight: 600, color: '#fff' },
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  controlsV: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 12px 16px', overflowY: 'auto' },
  ctrlLabel: { fontSize: 11, color: '#6b7280' },
  select: { background: '#161a22', border: '1px solid #262c3a', borderRadius: 8, color: '#e5e7eb', fontSize: 12, padding: '6px 8px', outline: 'none' },
  // Auto width so each control is only as wide as its selected text needs.
  selectV: { width: 'auto', maxWidth: 200, background: '#161a22', border: '1px solid #262c3a', borderRadius: 8, color: '#e5e7eb', fontSize: 12, padding: '7px 8px', outline: 'none' },
  reload: { background: '#161a22', border: '1px solid #262c3a', borderRadius: 8, color: '#e5e7eb', fontSize: 12, padding: '6px 10px', cursor: 'pointer' },
  zoomBar: { display: 'flex', alignItems: 'center', gap: 6, background: '#161a22', border: '1px solid #262c3a', borderRadius: 999, padding: '4px 6px' },
  zoomBarV: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: '#161a22', border: '1px solid #262c3a', borderRadius: 14, padding: '10px 8px' },
  zoomSliderV: { writingMode: 'vertical-lr', direction: 'rtl', width: 22, height: 104, accentColor: '#1d4ed8', cursor: 'pointer', margin: 0 },
  reloadV: { marginTop: 4, background: '#161a22', border: '1px solid #262c3a', borderRadius: 8, color: '#e5e7eb', fontSize: 12, padding: '8px 10px', cursor: 'pointer' },
  zoomFit: { background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, cursor: 'pointer' },
  zoomFitActive: { background: '#1d4ed8', color: '#fff' },
  zoomBtn: { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1115', border: '1px solid #262c3a', borderRadius: '50%', color: '#e5e7eb', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: 0 },
  zoomSlider: { width: 120, accentColor: '#1d4ed8', cursor: 'pointer' },
  zoomVal: { fontSize: 11, color: '#9ca3af', minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  canvas: { flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 },
  phone: { position: 'relative', flexShrink: 0, background: '#000', borderRadius: 36, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.5), 0 0 0 5px #111, 0 0 0 6px #2b3140', display: 'flex' },
  loading: { color: '#6b7280', fontSize: 14, padding: 24 },
  crash: { padding: 20, background: '#1a1114', color: '#fecaca', width: '100%', height: '100%', overflow: 'auto' },
  crashTitle: { fontWeight: 700, marginBottom: 10, color: '#f87171' },
  crashMsg: { fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'ui-monospace, monospace' },
};
