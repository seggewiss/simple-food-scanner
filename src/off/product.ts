import type { NewFood } from '@/db/schema';

import { fetchJson, OFF_PRODUCT_BASE, OffError, productLimiter } from './client';
import { normalizeProduct } from './normalize';
import { OFF_PRODUCT_FIELDS, type OffProductResponse } from './types';

export type ProductLookup =
  | { status: 'found'; food: NewFood }
  /** The barcode is genuinely not in the database. A normal path, not an error. */
  | { status: 'not_found'; barcode: string }
  /** Found upstream, but the record lacks the nutrition we need to log it. */
  | { status: 'incomplete'; barcode: string };

/** EAN-8/13 and UPC-A/E are all digits; reject anything else before spending a request. */
export function isPlausibleBarcode(barcode: string): boolean {
  return /^\d{8,14}$/.test(barcode);
}

export async function fetchProductByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<ProductLookup> {
  const url = `${OFF_PRODUCT_BASE}/api/v3/product/${encodeURIComponent(barcode)}.json?fields=${OFF_PRODUCT_FIELDS}`;

  let response: OffProductResponse;
  try {
    response = await fetchJson<OffProductResponse>(url, { limiter: productLimiter, signal });
  } catch (error) {
    // An unknown barcode comes back as a genuine HTTP 404 with a `status: "failure"`
    // body. That is an expected outcome — the product simply is not in the database —
    // so it must not surface as a network error the user has to interpret.
    if (error instanceof OffError && error.status === 404) {
      return { status: 'not_found', barcode };
    }
    throw error;
  }

  // Belt and braces: the body also carries a status field, and older/edge responses can
  // return 200 with `status: "failure"`.
  if (response.status !== 'success' || !response.product) {
    return { status: 'not_found', barcode };
  }

  const normalized = normalizeProduct(response.product, barcode);
  if (!normalized.ok) {
    return { status: 'incomplete', barcode };
  }

  return { status: 'found', food: normalized.food };
}
