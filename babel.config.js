module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    // Reanimated 4 split the worklet runtime into its own package; the babel
    // plugin moved here too. Must remain LAST in the plugin list.
    'react-native-worklets/plugin',
  ],
};
