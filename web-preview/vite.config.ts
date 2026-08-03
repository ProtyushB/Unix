import { defineConfig, loadEnv } from 'vite';
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

// The keys the app actually reads off `react-native-config` (src/config/env.ts
// and src/config/features.ts). Enumerated rather than passing the whole loaded
// env through: loadEnv with an empty prefix also returns process.env, and none
// of the machine's environment belongs in a bundle.
const RN_CONFIG_KEYS = [
  'AUTH_API_URL',
  'PERSON_API_URL',
  'PARLOUR_API_URL',
  'PHARMACY_API_URL',
  'RESTAURANT_API_URL',
  'DMS_API_URL',
  'DMS_APP_ROOT_FOLDER_ID',
  'DMS_BUSINESS_APP_ROOT_FOLDER_ID',
  'PAYMENT_QR_FILE_ID',
  // Read by src/config/appVersion.ts. Passed through so the preview reflects the
  // real .env, but VERSION_CODE is deliberately NOT here — it comes from Android's
  // generated BuildConfig, which has no web equivalent. So the preview reports
  // version 0 and the updater self-disables, which is correct: there is nothing to
  // install into a browser tab. It must not crash on the way there.
  'UPDATE_MANIFEST_URL',
] as const;

// Virtual module the react-native-config stub imports. A module rather than a
// `define` substitution: define only rewrites bare identifiers, and the stub's
// `typeof __RN_CONFIG__` guard slipped through unreplaced.
const RN_CONFIG_MODULE = 'virtual:rn-config';
const RN_CONFIG_MODULE_RESOLVED = '\0' + RN_CONFIG_MODULE;

// Web-first resolution: a Foo.web.tsx wins over Foo.tsx, matching RN's own
// platform-extension rules so any web-specific overrides are picked up.
const rnExtensions = [
  '.web.tsx',
  '.web.ts',
  '.web.jsx',
  '.web.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.json',
];

export default defineConfig(({ mode }) => {
  // Read the repo-root .env — the same file react-native-config bakes into a
  // native build — so the preview talks to whichever backend the build would.
  // '' as the prefix because these keys are not VITE_-prefixed.
  const rootEnv = loadEnv(mode, repoRoot, '');
  const rnConfig = Object.fromEntries(
    RN_CONFIG_KEYS.filter((k) => rootEnv[k]).map((k) => [k, rootEnv[k]]),
  );

  return {
    root: previewRoot,
    cacheDir: path.resolve(previewRoot, 'node_modules/.vite'),
    plugins: [
      {
        name: 'rn-config-env',
        resolveId: (id: string) => (id === RN_CONFIG_MODULE ? RN_CONFIG_MODULE_RESOLVED : null),
        load: (id: string) =>
          id === RN_CONFIG_MODULE_RESOLVED ? `export default ${JSON.stringify(rnConfig)}` : null,
      },
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
        {
          find: /^react-native-config$/,
          replacement: path.resolve(previewRoot, 'stubs/react-native-config.ts'),
        },
        // Native-only + ships untranspiled Flow source (breaks esbuild). Stubbed
        // with a real <input type="date"> so date fields stay usable.
        {
          find: /^@react-native-community\/datetimepicker$/,
          replacement: path.resolve(previewRoot, 'stubs/datetimepicker.tsx'),
        },
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
  };
});
