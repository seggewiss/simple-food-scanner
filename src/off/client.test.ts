import { describe, expect, it } from 'vitest';

import { RateLimiter, USER_AGENT } from './client';
import { isPlausibleBarcode } from './product';

describe('USER_AGENT', () => {
  it('matches the AppName/Version (contact) shape Open Food Facts requires', () => {
    expect(USER_AGENT).toMatch(/^\S+\/\d+\.\d+\.\d+ \(.+@.+\)$/);
  });
});

describe('RateLimiter', () => {
  it('allows requests up to the limit with no delay', () => {
    const limiter = new RateLimiter(3, 60_000);
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.delayFor(now)).toBe(0);
      // delayFor is a read; acquire is what records a request, so drive it directly.
      limiter['timestamps'].push(now);
    }
    expect(limiter.delayFor(now)).toBeGreaterThan(0);
  });

  it('makes the caller wait exactly until the oldest request ages out', () => {
    const limiter = new RateLimiter(2, 60_000);
    const start = 1_000_000;
    limiter['timestamps'].push(start, start + 10_000);

    expect(limiter.delayFor(start + 5_000)).toBe(55_000);
  });

  it('frees the budget again once the window has passed', () => {
    const limiter = new RateLimiter(2, 60_000);
    const start = 1_000_000;
    limiter['timestamps'].push(start, start + 1_000);

    expect(limiter.delayFor(start + 61_001)).toBe(0);
  });

  it('actually blocks and then proceeds when the budget is spent', async () => {
    const limiter = new RateLimiter(1, 50);
    await limiter.acquire();
    const started = Date.now();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
  });
});

describe('isPlausibleBarcode', () => {
  it('accepts EAN-8, EAN-13 and UPC lengths', () => {
    expect(isPlausibleBarcode('12345678')).toBe(true);
    expect(isPlausibleBarcode('3017624010701')).toBe(true);
    expect(isPlausibleBarcode('0894700010137')).toBe(true);
  });

  it('rejects anything that is not a plain digit string of retail length', () => {
    expect(isPlausibleBarcode('123')).toBe(false);
    expect(isPlausibleBarcode('https://example.com')).toBe(false);
    expect(isPlausibleBarcode('30176240107011234')).toBe(false);
    expect(isPlausibleBarcode('')).toBe(false);
  });
});
