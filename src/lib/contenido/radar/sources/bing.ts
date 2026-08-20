// Bing adapter via SerpAPI (engine=bing), extracting related_searches.
//
// Why not Bing Autosuggest: Microsoft retired the Bing Search APIs v7
// (including api.bing.microsoft.com/v7.0/Suggestions) on 2025-08-11; legacy
// keys now return HTTP 410 Gone. There is no official Microsoft autosuggest
// endpoint anymore, so this adapter uses SerpAPI's documented Bing Search API
// and takes the "related searches" block as the observed signal:
//   GET https://serpapi.com/search.json?engine=bing&q=...&cc=ec&setlang=es&api_key=KEY
//   -> { related_searches: [{ query, link }] }
// Docs: https://serpapi.com/bing-search-api
//
// This is NOT autocomplete: signalType is 'related-search-query'.

import { readEnv } from '../env.ts';
import type { RawRadarQuery } from '../types.ts';
import { fetchJson } from './http.ts';
import { countryToIso, countryToBingCc } from './geo.ts';
import { disabledResult, errorResult, okResult, type SourceAdapter, type SourceRunResult } from './types.ts';

const ENV_VAR = 'SERPAPI_API_KEY';

interface SerpApiBingResponse {
  related_searches?: { query?: unknown }[];
}

export function parseRelatedSearches(data: unknown): string[] {
  const related = (data as SerpApiBingResponse | null)?.related_searches;
  if (!Array.isArray(related)) return [];
  return related
    .map((r) => (r && typeof r.query === 'string' ? r.query.trim() : ''))
    .filter((v) => v.length > 0);
}

export const bingAdapter: SourceAdapter = {
  id: 'bing',
  label: 'Bing Related Searches',
  signalType: 'related-search-query',
  endpoint: 'serpapi.com/search.json?engine=bing',
  envVar: ENV_VAR,
  setupInstructions:
    'Usa la misma SERPAPI_API_KEY de SerpAPI (serpapi.com). La API oficial de Bing Autosuggest fue retirada por Microsoft el 2025-08-11; esta fuente usa busquedas relacionadas de Bing via SerpAPI.',

  isConfigured(): boolean {
    return Boolean(readEnv(ENV_VAR));
  },

  async fetchSuggestions(input): Promise<SourceRunResult> {
    const apiKey = readEnv(ENV_VAR);
    if (!apiKey) return disabledResult();
    try {
      const params = new URLSearchParams({
        engine: 'bing',
        q: input.seed,
        setlang: input.lang,
        api_key: apiKey,
      });
      const cc = countryToBingCc(input.country);
      if (cc) params.set('cc', cc);
      const { data } = await fetchJson(`https://serpapi.com/search.json?${params}`, input.timeoutMs);
      const values = parseRelatedSearches(data);
      const capturedAt = new Date().toISOString();
      const iso = countryToIso(input.country);
      const queries: RawRadarQuery[] = values.map((value) => ({
        query: value,
        original: value,
        source: 'bing',
        signalType: 'related-search-query',
        observed: true,
        capturedAt,
        locale: iso ? `${input.lang}-${iso.toUpperCase()}` : input.lang,
      }));
      return okResult(queries);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};
