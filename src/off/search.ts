import { fetchJson, OFF_SEARCH_BASE, searchLimiter } from './client';
import { normalizeSearchHit, type SearchResultFood } from './normalize';
import { OFF_SEARCH_FIELDS, type OffSearchResponse } from './types';

/**
 * Text search against Search-a-licious.
 *
 * The old `/cgi/search.pl` endpoint on world.openfoodfacts.org is retired and returns
 * 503s; search.openfoodfacts.org is its replacement. Do not "fix" a search failure by
 * pointing back at the legacy host.
 */
export type SearchOptions = {
  page?: number;
  pageSize?: number;
  /** Language codes to bias results toward, e.g. `['de', 'en']`. */
  langs?: string[];
  signal?: AbortSignal;
};

export type SearchPage = {
  results: SearchResultFood[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchFoods(
  query: string,
  { page = 1, pageSize = 25, langs = ['en'], signal }: SearchOptions = {},
): Promise<SearchPage> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { results: [], total: 0, page, pageSize };
  }

  const params = new URLSearchParams({
    q: trimmed,
    page: String(page),
    page_size: String(pageSize),
    fields: OFF_SEARCH_FIELDS,
    langs: langs.join(','),
  });

  const response = await fetchJson<OffSearchResponse>(
    `${OFF_SEARCH_BASE}/search?${params.toString()}`,
    { limiter: searchLimiter, signal },
  );

  const results = (response.hits ?? [])
    .map(normalizeSearchHit)
    .filter((hit): hit is SearchResultFood => hit !== null);

  return {
    results,
    total: response.count ?? results.length,
    page: response.page ?? page,
    pageSize: response.page_size ?? pageSize,
  };
}
