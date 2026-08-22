// YouTube adapter via the official YouTube Data API v3 search.list endpoint.
//
// YouTube has no official autocomplete API. search.list is a real, documented
// endpoint that returns videos matching a query; this adapter uses video
// titles as RELATED VIDEO TOPICS, not autocomplete suggestions:
//   GET https://www.googleapis.com/youtube/v3/search?part=snippet&type=video
//       &q=...&maxResults=10&regionCode=EC&relevanceLanguage=es&key=KEY
//   -> { items: [{ snippet: { title } }] }
// Errors: 403 with reason quotaExceeded / keyInvalid, 400 for bad params.
// Docs: https://developers.google.com/youtube/v3/docs/search/list
// Quota: search.list costs 100 units/call (default daily quota 10,000).
//
// signalType is 'related-video-topic' — never 'autocomplete'.

import { readEnv } from '../../../../../lib/env.ts';
import type { RawRadarQuery } from '../types.ts';
import { fetchJson } from './http.ts';
import { countryToIso } from './geo.ts';
import { disabledResult, errorResult, okResult, type SourceAdapter, type SourceRunResult } from './types.ts';

const ENV_VAR = 'YOUTUBE_API_KEY';

interface YouTubeSearchResponse {
  items?: { snippet?: { title?: unknown } }[];
}

export function parseVideoTitles(data: unknown): string[] {
  const items = (data as YouTubeSearchResponse | null)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const title = it?.snippet?.title;
      return typeof title === 'string' ? decodeEntities(title.trim()) : '';
    })
    .filter((v) => v.length > 0);
}

/** YouTube titles come HTML-escaped (&amp; &#39; &quot;). Decode the common ones. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export const youtubeAdapter: SourceAdapter = {
  id: 'youtube',
  label: 'YouTube Search',
  signalType: 'related-video-topic',
  endpoint: 'googleapis.com/youtube/v3/search (search.list)',
  envVar: ENV_VAR,
  setupInstructions:
    'En Google Cloud Console crea un proyecto, habilita "YouTube Data API v3", crea una API key y define YOUTUBE_API_KEY en el entorno del servidor. search.list consume 100 unidades de cuota por llamada.',

  isConfigured(): boolean {
    return Boolean(readEnv(ENV_VAR));
  },

  async fetchSuggestions(input): Promise<SourceRunResult> {
    const apiKey = readEnv(ENV_VAR);
    if (!apiKey) return disabledResult();
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q: input.seed,
        maxResults: '10',
        relevanceLanguage: input.lang,
        key: apiKey,
      });
      const region = countryToIso(input.country);
      if (region) params.set('regionCode', region.toUpperCase());
      const { data } = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`, input.timeoutMs);
      const values = parseVideoTitles(data);
      const capturedAt = new Date().toISOString();
      const iso = countryToIso(input.country);
      const queries: RawRadarQuery[] = values.map((value) => ({
        query: value,
        original: value,
        source: 'youtube',
        signalType: 'related-video-topic',
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
