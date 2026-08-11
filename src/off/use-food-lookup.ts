import { useQuery } from '@tanstack/react-query';

import { getFoodByBarcode, upsertFood } from '@/db/repository';
import type { Food } from '@/db/schema';

import { OffError } from './client';
import { fetchProductByBarcode } from './product';

export type FoodLookup =
  /** Usable food, either fresh from Open Food Facts or served from the local cache. */
  | { status: 'found'; food: Food; fromCache: boolean }
  /** Not in Open Food Facts, and not cached. The user should create a custom food. */
  | { status: 'not_found'; barcode: string }
  /** Upstream has the product but not enough nutrition to log it. */
  | { status: 'incomplete'; barcode: string }
  /** Network failed and nothing is cached locally. */
  | { status: 'offline'; barcode: string };

/**
 * Barcode → food, cache-first on failure.
 *
 * Order matters: Open Food Facts is tried first so a refreshed record wins, but any
 * network problem falls back to the local copy. A food you have scanned before must
 * keep working with the radio off — that is the whole point of local-first storage.
 */
export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodLookup> {
  try {
    const remote = await fetchProductByBarcode(barcode, signal);

    if (remote.status === 'found') {
      const food = await upsertFood(remote.food);
      return { status: 'found', food, fromCache: false };
    }

    // Upstream says no. A locally cached or hand-edited copy still counts as a hit.
    const cached = await getFoodByBarcode(barcode);
    if (cached) return { status: 'found', food: cached, fromCache: true };

    return remote.status === 'incomplete'
      ? { status: 'incomplete', barcode }
      : { status: 'not_found', barcode };
  } catch (error) {
    const cached = await getFoodByBarcode(barcode);
    if (cached) return { status: 'found', food: cached, fromCache: true };

    if (error instanceof OffError) return { status: 'offline', barcode };
    throw error;
  }
}

export function useFoodLookup(barcode: string | undefined) {
  return useQuery({
    queryKey: ['off', 'barcode', barcode],
    enabled: Boolean(barcode),
    queryFn: ({ signal }) => lookupBarcode(barcode as string, signal),
  });
}
