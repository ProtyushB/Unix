// Web stub for `react-native-config`, which has no browser build.
//
// Values come from the repo-root .env — the same file react-native-config bakes
// into a native build — read by web-preview/vite.config.ts and served as the
// `virtual:rn-config` module. So the preview talks to whichever backend the APK
// would, and repointing .env moves both together.
//
// Any missing key returns '' rather than throwing, which is what makes
// src/config/env.ts log its "missing .env" warning and fall back to localhost.
// @ts-expect-error — virtual module supplied by the rn-config-env Vite plugin.
import rnConfig from 'virtual:rn-config';

const values: Record<string, string> = { ...(rnConfig as Record<string, string>) };

const Config = new Proxy(values, {
  get: (target, key: string) => (key in target ? target[key] : ''),
});

export default Config;
