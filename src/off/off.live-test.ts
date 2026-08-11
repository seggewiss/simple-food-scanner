import { describe, expect, it } from 'vitest';

import { fetchProductByBarcode } from './product';
import { searchFoods } from './search';

/**
 * Contract tests against the live Open Food Facts services. Run with `npm run test:live`.
 *
 * These exist so an upstream change surfaces as a failing test with a clear message
 * rather than as a mysteriously empty food list in the app. They are excluded from the
 * default test run because they need network and consume rate-limit budget.
 */
describe('Open Food Facts product API', () => {
  it('returns a normalized food for a known barcode', async () => {
    const result = await fetchProductByBarcode('3017624010701');

    expect(result.status).toBe('found');
    if (result.status !== 'found') return;

    expect(result.food.barcode).toBe('3017624010701');
    expect(result.food.name.toLowerCase()).toContain('nutella');
    expect(result.food.kcalPer100g).toBeGreaterThan(400);
  });

  it('reports an unknown barcode as not_found rather than throwing', async () => {
    const result = await fetchProductByBarcode('00000000000000');
    expect(result.status).toBe('not_found');
  });
});

describe('Open Food Facts search API', () => {
  it('returns hits with barcodes for a plain text query', async () => {
    const page = await searchFoods('greek yogurt', { pageSize: 5 });

    expect(page.results.length).toBeGreaterThan(0);
    expect(page.total).toBeGreaterThan(0);
    for (const hit of page.results) {
      expect(hit.barcode).toMatch(/^\d+$/);
      expect(hit.name.length).toBeGreaterThan(0);
    }
  });

  it('short-circuits without a request for queries under two characters', async () => {
    const page = await searchFoods('a');
    expect(page.results).toEqual([]);
  });
});
