const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable problematic cache to fix the store.get error
config.cacheStores = [];

// Alternative cache configuration
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Reset cache on startup
config.resetCache = true;

module.exports = config;