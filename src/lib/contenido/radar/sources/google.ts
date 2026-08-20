// Google Autocomplete adapter. Opt-in: requires GOOGLE_API_KEY (Custom Search API or Suggest proxy).
// Without a key it returns [] and the radar continues with the local generator.

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/**
 * Fetches Google autocomplete suggestions.
 * Requires GOOGLE_API_KEY. If not set, returns empty array.
 */
export async function fetchGoogleSuggestions(seed: string): Promise<string[]> {
  if (!GOOGLE_API_KEY) return [];
  // Note: This is a placeholder integration. Google's official autocomplete endpoint
  // is not a public JSON API. You can plug in a proxy or a paid suggest service here.
  // Do not invent fake responses; return real data only when a valid endpoint is configured.
  console.warn('[content-radar] GOOGLE_API_KEY configured but no official public autocomplete endpoint is implemented. Returning [].');
  return [];
}

export { GOOGLE_API_KEY };
