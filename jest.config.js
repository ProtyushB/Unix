/**
 * Minimal jest setup.
 *
 * `"test": "jest"` existed in package.json long before any test did, with no
 * config behind it. This adds the config, not a testing strategy.
 *
 * Deliberately plain node — NOT the react-native jest preset. Nothing here
 * renders a component or touches a native module; `evaluateManifest` is kept
 * free of React Native imports precisely so it can be tested without standing up
 * that whole environment. If a test ever does need to render, add a second
 * project rather than converting this one, so the fast path stays fast.
 *
 * babel-jest picks up babel.config.js automatically, which is what compiles the
 * TypeScript.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // One narrow exception to "no React Native here": `Libraries/Network/FormData`, which
  // `pendingFiles.formdata.test.ts` drives directly. It is a leaf — no imports of its own, no
  // native module, no renderer — so it costs nothing, and it is the one piece of the upload path
  // the web preview genuinely cannot exercise. Everything else in node_modules stays untransformed.
  transformIgnorePatterns: ['node_modules/(?!react-native/Libraries/Network/FormData)'],
};
