import path from 'node:path';
export default {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['spectrum-ts'],
  // Help Bot: /coach imports the chat straight from ../web/src (Security Arcade web app).
  experimental: { externalDir: true },
  webpack(config) {
    // One copy of the SpacetimeDB SDK (web/src would otherwise resolve web/node_modules).
    config.resolve.alias = { ...config.resolve.alias, spacetimedb$: path.resolve('node_modules/spacetimedb') };
    return config;
  },
};
