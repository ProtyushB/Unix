// Expo SDK 55+: Metro config must extend expo/metro-config so the dev server
// registers the `.expo/.virtual-metro-entry` virtual module that the native
// app requests at startup.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  blockList: [
    /.*\/android\/.*/,
    /.*\/ios\/.*/,
  ],
};

module.exports = config;
