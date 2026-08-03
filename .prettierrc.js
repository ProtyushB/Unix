/**
 * Inferred from the code rather than picked: these are the settings under which the existing tree
 * needs the fewest changes, so this records the de-facto style instead of imposing a new one.
 *
 * Everything not listed is a prettier default, including bracketSpacing — the codebase writes
 * `{ channel, value }`, not the React Native template's `{channel, value}`.
 */
module.exports = {
  singleQuote: true,
  // 80 (the default) rewraps a great deal of code that reads fine as-is; 100 is the width the tree
  // was already written to.
  printWidth: 100,
  // git is set to core.autocrlf=true here, so the working tree is CRLF while the repo stores LF.
  // Pinning 'lf' would make prettier rewrite every line on a Windows checkout; 'auto' takes each
  // file as it finds it and leaves the normalisation to git.
  endOfLine: 'auto',
};
