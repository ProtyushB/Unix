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

    // Downgraded from the preset's `error` DELIBERATELY, and only until someone works through them.
    // There are 10 real sites. Every one is a judgement call rather than a mechanical fix: adding
    // the missing dependency to an effect that also sets that value is how you get a render loop,
    // and several of these are animation refs where the current omission is probably correct and
    // the honest fix is a useRef, not a longer array. Silencing them per-line with disable comments
    // would hide the list; leaving them as errors would mean `npm run lint` never goes green and
    // stops being read. A warning keeps all 10 visible and countable.
    'react-hooks/exhaustive-deps': 'warn',
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
