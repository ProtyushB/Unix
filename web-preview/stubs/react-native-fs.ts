// Web stub for `react-native-fs` — native-only, no browser build.
//
// Reached only through `useDmsImages`, which downloads a ZIP of DMS files, unpacks it and writes
// each entry to the app's cache directory so `<Image>` can read a `file://` path. There is no
// filesystem to write to in a browser, so every call here fails softly and the hook falls back to
// showing no image rather than crashing the screen.
//
// This exists mainly as a bundling guard: `src/backend/dms/index.ts` re-exports `useDmsImages`, so
// the moment anything imports that barrel, RNFS is pulled into the graph and the preview stops
// booting. Importing DMS pieces by direct path avoids that; this stub covers the case where
// someone reaches for the barrel anyway.

const notSupported = (name: string) => () =>
  Promise.reject(new Error(`react-native-fs.${name} is not available in the web preview`));

export const CachesDirectoryPath = '/tmp';
export const DocumentDirectoryPath = '/tmp';
export const TemporaryDirectoryPath = '/tmp';

export const exists = () => Promise.resolve(false);
export const mkdir = () => Promise.resolve();
export const unlink = () => Promise.resolve();
export const writeFile = notSupported('writeFile');
export const readFile = notSupported('readFile');
export const readDir = () => Promise.resolve([]);
export const downloadFile = () => ({ promise: notSupported('downloadFile')() });

export default {
  CachesDirectoryPath,
  DocumentDirectoryPath,
  TemporaryDirectoryPath,
  exists,
  mkdir,
  unlink,
  writeFile,
  readFile,
  readDir,
  downloadFile,
};
