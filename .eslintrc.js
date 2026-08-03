/**
 * `npm run lint` existed in package.json from the day the project was generated, but there was
 * never a config for it to find, so it has only ever printed "ESLint couldn't find a configuration
 * file". This is that file.
 *
 * @react-native is the preset the CLI ships with. It pulls in eslint-config-prettier last, which
 * turns OFF every formatting rule — so this file and .prettierrc.js do not overlap and cannot
 * disagree. Formatting is prettier's job; this is only about correctness.
 */
module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // The preset leaves this as a warning. Unused imports and dead locals are exactly what went
    // stale during the screen rewrites, so it is an error here — cheap to fix, and it catches a
    // deleted module's leftovers the way spotless does on the backend.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // `catch (_) {}` is the codebase's way of saying "this failure is deliberately ignored" —
        // see the updater and the token-refresh paths, where a throw must never reach the user.
        caughtErrorsIgnorePattern: '^_',
        // `const {appointmentStatus, ...noStatus} = raw` is how the model tests build a fixture
        // with one field missing. The named key is meant to be discarded, not read.
        ignoreRestSiblings: true,
      },
    ],

    // Left at the preset's `error`. It was briefly a warning while the 10 pre-existing sites were
    // worked through; they are all fixed, so the gate goes back up rather than leaving a rule
    // permanently relaxed for problems that no longer exist.
    'react-hooks/exhaustive-deps': 'error',

    // `void somePromise();` as a STATEMENT is how the updater marks a promise it intentionally does
    // not await — see useAppUpdate, where every failure path is deliberately silent. Deleting the
    // keyword would not change behaviour, it would just remove the marker saying the omission was
    // on purpose. `void` used as an expression is still rejected.
    'no-void': ['error', { allowAsStatement: true }],
  },
  overrides: [
    {
      // The web preview is a development harness, not shipped app code: its stubs deliberately
      // stand in for native modules and use inline styles for one-off debug chrome.
      files: ['web-preview/**/*.{ts,tsx}'],
      rules: { 'react-native/no-inline-styles': 'off' },
    },
  ],
};
