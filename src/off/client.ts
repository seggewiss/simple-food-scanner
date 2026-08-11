/**
 * Shared plumbing for every Open Food Facts request.
 *
 * Open Food Facts is a volunteer-run service that gives away the data this whole app
 * depends on. The rules below are their published requirements, not optimizations:
 *
 *   - A custom User-Agent is mandatory. Anonymous clients get treated as bots.
 *   - 15 product reads/min/IP and 10 searches/min/IP.
 *
 * See https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

export const OFF_PRODUCT_BASE = 'https://world.openfoodfacts.org';
export const OFF_SEARCH_BASE = 'https://search.openfoodfacts.org';

const APP_VERSION = '0.1.0';
const CONTACT = 'sebastianseggewiss@gmail.com';
export const USER_AGENT = `SimpleFoodScanner/${APP_VERSION} (${CONTACT})`;

const DEFAULT_TIMEOUT_MS = 8_000;

export class OffError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'timeout' | 'http' | 'rate_limit' | 'parse',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OffError';
  }
}

/**
 * Sliding-window limiter. Rather than rejecting when the budget is spent, it waits for
 * the oldest request in the window to age out — a scan that arrives during a burst
 * should be slow, not failed.
 */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  private prune(now: number) {
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }

  /** Milliseconds the caller must wait before a request fits in the budget. */
  delayFor(now: number = Date.now()): number {
    this.prune(now);
    if (this.timestamps.length < this.limit) return 0;
    return this.timestamps[0] + this.windowMs - now;
  }

  async acquire(): Promise<void> {
    const wait = this.delayFor();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.timestamps.push(Date.now());
  }
}

// Separate buckets: the two endpoints have separate published budgets.
export const productLimiter = new RateLimiter(15);
export const searchLimiter = new RateLimiter(10);

/**
 * In-flight deduplication. The camera can fire the same barcode several times before a
 * response lands, and a search box re-issues on every keystroke; without this the app
 * burns its own rate-limit budget on identical requests.
 */
const inFlight = new Map<string, Promise<unknown>>();

type FetchJsonOptions = {
  limiter: RateLimiter;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;

  const request = performFetch<T>(url, options).finally(() => {
    inFlight.delete(url);
  });

  inFlight.set(url, request);
  return request;
}

async function performFetch<T>(
  url: string,
  { limiter, timeoutMs = DEFAULT_TIMEOUT_MS, signal }: FetchJsonOptions,
): Promise<T> {
  await limiter.acquire();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new OffError('Open Food Facts rate limit reached', 'rate_limit', 429);
    }
    if (!response.ok) {
      throw new OffError(`Open Food Facts returned ${response.status}`, 'http', response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new OffError('Open Food Facts returned malformed JSON', 'parse');
    }
  } catch (error) {
    if (error instanceof OffError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OffError('Open Food Facts request timed out', 'timeout');
    }
    throw new OffError(
      error instanceof Error ? error.message : 'Network request failed',
      'network',
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Exposed so tests can start from a clean slate. */
export function clearInFlight() {
  inFlight.clear();
}
