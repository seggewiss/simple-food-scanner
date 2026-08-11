/**
 * Minimal shapes for the parts of Open Food Facts we consume. Deliberately loose:
 * the data is crowd-sourced, and nearly every field is optional or arrives as either a
 * string or a number depending on who entered it.
 */

export type OffNutriments = Record<string, string | number | undefined>;

export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string | null;
  serving_quantity?: string | number | null;
  nutriments?: OffNutriments;
  image_front_small_url?: string;
  image_small_url?: string;
};

export type OffProductResponse = {
  status?: string;
  result?: { id?: string; name?: string };
  product?: OffProduct;
};

/** Search-a-licious hit. `product_name` and `brands` can come back as arrays. */
export type OffSearchHit = {
  code?: string;
  product_name?: string | string[];
  brands?: string | string[];
  nutriments?: OffNutriments;
  image_front_small_url?: string;
  serving_quantity?: string | number | null;
  serving_size?: string | null;
};

export type OffSearchResponse = {
  hits?: OffSearchHit[];
  count?: number;
  page?: number;
  page_size?: number;
  timed_out?: boolean;
};

/** The fields we ask for. Requesting everything returns a very large document. */
export const OFF_PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'image_front_small_url',
].join(',');

export const OFF_SEARCH_FIELDS = [
  'code',
  'product_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'image_front_small_url',
].join(',');
