import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests cover the pure domain modules only — nutrition math and Open Food Facts
 * normalization. Nothing here imports react-native, so no RN preset is needed.
 * Tests that hit the real Open Food Facts API live in vitest.live.config.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
