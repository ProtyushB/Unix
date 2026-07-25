import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone react-native-web preview bundler.
//
// This config is intentionally isolated from the native app: it lives in
// web-preview/, never runs during `react-native run-android|ios`, and does not
// touch Metro, Expo, or the native entry (index.js). It simply aliases
// `react-native` -> `react-native-web` and renders your existing screens
// (from ../src) in Chrome so UI can be eyeballed without a device/emulator.
// ─────────────────────────────────────────────────────────────────────────────

const previewRoot = __dirname;
const repoRoot = path.resolve(previewRoot, '..');

// Web-first resolution: a Foo.web.tsx wins over Foo.tsx, matching RN's own
// platform-extension rules so any web-specific overrides are picked up.
const rnExtensions = [
  '.web.tsx', '.web.ts', '.web.jsx', '.web.js',
  '.tsx', '.ts', '.jsx', '.js', '.json',
];

export default defineConfig({
  root: previewRoot,
  cacheDir: path.resolve(previewRoot, 'node_modules/.vite'),
  plugins: [
    react({
      // Run the worklets babel plugin over project source (../src) so screens
      // that define reanimated worklets don't crash on web. node_modules are
      // left untouched (they ship compiled).
      babel: {
        babelrc: false,
        configFile: false,
        plugins: ['react-native-worklets/plugin'],
      },
    }),
  ],
  define: {
    global: 'globalThis',
    __DEV__: 'true',
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env.EXPO_OS': JSON.stringify('web'),
  },
  resolve: {
    extensions: rnExtensions,
    // A single copy of each — screens + harness must share one React instance
    // or hooks break.
    dedupe: ['react', 'react-dom', 'react-native-web'],
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      // Native-only module: no web build. Stub it so screens that transitively
      // import it (via src/config/features.ts) still bundle.
      { find: /^react-native-config$/, replacement: path.resolve(previewRoot, 'stubs/react-native-config.ts') },
      // Native-only + ships untranspiled Flow source (breaks esbuild). Stubbed
      // with a real <input type="date"> so date fields stay usable.
      { find: /^@react-native-community\/datetimepicker$/, replacement: path.resolve(previewRoot, 'stubs/datetimepicker.tsx') },
      // lucide-react-native@1.11.0 has a broken ESM build. lucide-react shares
      // the same icon names + size/color API and renders SVG that works fine
      // inside react-native-web.
      { find: /^lucide-react-native$/, replacement: 'lucide-react' },
    ],
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: rnExtensions,
      // Many RN packages ship .js files containing JSX. Tell esbuild to parse
      // every .js as JSX during pre-bundling.
      loader: { '.js': 'jsx' },
      jsx: 'automatic',
      define: { global: 'globalThis', __DEV__: 'true' },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    open: false,
    // Screens live in ../src, outside this Vite root — allow serving them.
    fs: { allow: [repoRoot] },
  },
});
