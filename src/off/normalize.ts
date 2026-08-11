import type { NewFood } from '@/db/schema';

import type { OffNutriments, OffProduct, OffSearchHit } from './types';

/** kJ per kcal, used when a product only carries the kilojoule figure. */
const KJ_PER_KCAL = 4.184;

/** Coerce a crowd-sourced value that may be a number, a numeric string, or junk. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    // Contributors enter things like "12,5" or "30 g".
    const cleaned = value.replace(',', '.').replace(/[^\d.eE+-]/g, '');
    if (cleaned === '') return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nutriment(nutriments: OffNutriments | undefined, key: string): number | null {
  if (!nutriments) return null;
  return toNumber(nutriments[key]);
}

/**
 * Energy per 100 g in kcal.
 *
 * `energy-kcal_100g` is the preferred key, but plenty of European products only carry
 * kilojoules, so fall back to `energy_100g` (kJ) and convert.
 */
export function energyKcalPer100g(nutriments: OffNutriments | undefined): number | null {
  const kcal = nutriment(nutriments, 'energy-kcal_100g');
  if (kcal != null) return kcal;

  const kj = nutriment(nutriments, 'energy-kj_100g') ?? nutriment(nutriments, 'energy_100g');
  if (kj != null) return kj / KJ_PER_KCAL;

  return null;
}

/**
 * Pick a display name. Falls through progressively worse options and ends at the
 * barcode, because a row with an empty name is unusable in a list.
 */
export function pickName(product: OffProduct, barcode: string): string {
  const candidates = [
    product.product_name,
    product.product_name_en,
    product.generic_name,
    product.brands,
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return `Unknown product ${barcode}`;
}

/**
 * Serving size in grams, or null.
 *
 * Null is the common case — the Nutella record, for example, has neither `serving_size`
 * nor `serving_quantity`. Callers must handle it rather than assuming a serving exists.
 */
export function servingGrams(product: Pick<OffProduct, 'serving_quantity' | 'serving_size'>): number | null {
  const quantity = toNumber(product.serving_quantity);
  if (quantity != null && quantity > 0) return quantity;

  // `serving_size` is free text like "30 g" or "1 cup (240 ml)". Only trust it when it
  // starts with a number followed by a gram or millilitre unit.
  const match = product.serving_size?.trim().match(/^([\d.,]+)\s*(g|ml)\b/i);
  if (match) {
    const parsed = toNumber(match[1]);
    if (parsed != null && parsed > 0) return parsed;
  }

  return null;
}

/** Drinks are published per 100 ml; `quantity` is the only hint upstream gives us. */
function inferBaseUnit(product: OffProduct): 'g' | 'ml' {
  const haystack = `${product.quantity ?? ''} ${product.serving_size ?? ''}`.toLowerCase();
  return /\b\d+\s*(ml|l|cl)\b/.test(haystack) ? 'ml' : 'g';
}

export type NormalizeResult =
  | { ok: true; food: NewFood }
  | { ok: false; reason: 'no_barcode' | 'no_energy' };

/**
 * Map an Open Food Facts product onto a local `foods` row.
 *
 * A product with no usable energy value is rejected rather than stored as zero calories:
 * silently logging 0 kcal is worse than telling the user the record is incomplete and
 * offering to fill it in by hand.
 */
export function normalizeProduct(
  product: OffProduct,
  fallbackBarcode?: string,
  now: number = Date.now(),
): NormalizeResult {
  const barcode = (product.code ?? fallbackBarcode)?.trim();
  if (!barcode) return { ok: false, reason: 'no_barcode' };

  const kcal = energyKcalPer100g(product.nutriments);
  if (kcal == null) return { ok: false, reason: 'no_energy' };

  const nutriments = product.nutriments;
  const seconds = Math.floor(now / 1000);

  return {
    ok: true,
    food: {
      // The barcode is globally unique and stable, so it doubles as the row id. That
      // makes cache upserts idempotent without a lookup first.
      id: `off:${barcode}`,
      source: 'off',
      barcode,
      name: pickName(product, barcode),
      brand: product.brands?.split(',')[0]?.trim() || null,
      kcalPer100g: Math.max(0, kcal),
      proteinPer100g: Math.max(0, nutriment(nutriments, 'proteins_100g') ?? 0),
      carbsPer100g: Math.max(0, nutriment(nutriments, 'carbohydrates_100g') ?? 0),
      fatPer100g: Math.max(0, nutriment(nutriments, 'fat_100g') ?? 0),
      fiberPer100g: nutriment(nutriments, 'fiber_100g'),
      sugarPer100g: nutriment(nutriments, 'sugars_100g'),
      satFatPer100g: nutriment(nutriments, 'saturated-fat_100g'),
      saltPer100g: nutriment(nutriments, 'salt_100g'),
      baseUnit: inferBaseUnit(product),
      servingSizeG: servingGrams(product),
      servingLabel: product.serving_size?.trim() || null,
      imageUrl: product.image_front_small_url ?? null,
      fetchedAt: seconds,
      createdAt: seconds,
      updatedAt: seconds,
      deletedAt: null,
    },
  };
}

/** Search-a-licious returns some fields as arrays; flatten to the first entry. */
function firstOf(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export type SearchResultFood = {
  barcode: string;
  name: string;
  brand: string | null;
  kcalPer100g: number | null;
  imageUrl: string | null;
};

/** Lightweight mapping for the search list. Full normalization happens on selection. */
export function normalizeSearchHit(hit: OffSearchHit): SearchResultFood | null {
  const barcode = hit.code?.trim();
  if (!barcode) return null;

  const name = firstOf(hit.product_name)?.trim();
  const brand = firstOf(hit.brands)?.trim() ?? null;

  return {
    barcode,
    name: name || brand || `Unknown product ${barcode}`,
    brand,
    kcalPer100g: energyKcalPer100g(hit.nutriments),
    imageUrl: hit.image_front_small_url ?? null,
  };
}
