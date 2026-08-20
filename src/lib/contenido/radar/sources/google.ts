// Google Autocomplete adapter via SerpAPI (engine=google_autocomplete).
//
// Why SerpAPI: Google does not offer an official public autocomplete JSON API.
// SerpAPI is a legitimate, documented provider with a stable contract:
//   GET https://serpapi.com/search.json?engine=google_autocomplete&q=...&hl=es&gl=ec&api_key=KEY
//   -> { suggestions: [{ value, relevance, type }] }
// Docs: https://serpapi.com/google-autocomplete-api
//
// Signal: real autocomplete suggestions observed in Google. No volume data.

import { readEnv } from '../env.ts';
import type { RawRadarQuery } from '../types.ts';
import { fetchJson } from './http.ts';
import { countryToIso } from './geo.ts';
import { disabledResult, errorResult, okResult, type SourceAdapter, type SourceRunResult } from './types.ts';

const ENV_VAR = 'SERPAPI_API_KEY';

interface SerpApiSuggestion {
  value?: unknown;
}

interface SerpApiAutocompleteResponse {
  suggestions?: SerpApiSuggestion[];
}

export function parseSuggestions(data: unknown): string[] {
  const suggestions = (data as SerpApiAutocompleteResponse | null)?.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions
    .map((s) => (s && typeof s.value === 'string' ? s.value.trim() : ''))
    .filter((v) => v.length > 0);
}

export const googleAdapter: SourceAdapter = {
  id: 'google',
  label: 'Google Autocomplete',
  signalType: 'autocomplete-suggestion',
  endpoint: 'serpapi.com/search.json?engine=google_autocomplete',
  envVar: ENV_VAR,
  setupInstructions:
    'Crea una cuenta en serpapi.com, copia tu API key y define SERPAPI_API_KEY en el entorno del servidor (.env local o secrets del VPS).',

  isConfigured(): boolean {
    return Boolean(readEnv(ENV_VAR));
  },

  async fetchSuggestions(input): Promise<SourceRunResult> {
    const apiKey = readEnv(ENV_VAR);
    if (!apiKey) return disabledResult();
    try {
      const params = new URLSearchParams({
        engine: 'google_autocomplete',
        q: input.seed,
        hl: input.lang,
        api_key: apiKey,
      });
      const gl = countryToIso(input.country);
      if (gl) params.set('gl', gl);
      const { data } = await fetchJson(`https://serpapi.com/search.json?${params}`, input.timeoutMs);
      const values = parseSuggestions(data);
      const capturedAt = new Date().toISOString();
      const iso = countryToIso(input.country);
      const queries: RawRadarQuery[] = values.map((value) => ({
        query: value,
        original: value,
        source: 'google',
        signalType: 'autocomplete-suggestion',
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
