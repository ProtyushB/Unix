// Web stub for `react-native-config`, which has no browser build.
//
// The app only reads a couple of keys from it (see src/config/features.ts), and
// always at import time, so a plain object with the .env defaults is enough for
// UI preview. Any missing key returns '' rather than throwing.
const values: Record<string, string> = {
  PAYMENT_QR_FILE_ID: '0',
};

const Config = new Proxy(values, {
  get: (target, key: string) => (key in target ? target[key] : ''),
});

export default Config;
