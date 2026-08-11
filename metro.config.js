const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Let Metro resolve the `.sql` files that Drizzle's migrations bundle imports.
config.resolver.sourceExts.push('sql');

// expo-sqlite on web ships a wa-sqlite WASM binary that its worker imports directly.
config.resolver.assetExts.push('wasm');

// wa-sqlite needs SharedArrayBuffer, which browsers only expose on cross-origin
// isolated pages. Send the isolation headers from the dev server too.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return middleware(req, res, next);
  };
};

module.exports = config;
