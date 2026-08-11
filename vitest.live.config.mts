import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Contract tests against the real Open Food Facts endpoints. Deliberately kept out of
 * the default `npm test` run: they need network, and they are subject to Open Food
 * Facts' rate limits (15 product reads/min, 10 searches/min per IP). Run them manually
 * with `npm run test:live` when you suspect an upstream API change.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.live-test.ts'],
    testTimeout: 30_000,
    // Sequential, so the client's rate limiter sees one caller and we stay well under
    // the per-IP budget.
    fileParallelism: false,
  },
});
