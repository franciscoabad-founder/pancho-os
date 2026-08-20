// Bing Autosuggest adapter. Opt-in: requires BING_API_KEY.
// Without a key it returns [] and the radar continues with the local generator.

const BING_API_KEY = process.env.BING_API_KEY;

/**
 * Fetches Bing autosuggest results.
 * Requires BING_API_KEY. If not set, returns empty array.
 */
export async function fetchBingSuggestions(seed: string): Promise<string[]> {
  if (!BING_API_KEY) return [];
  // Placeholder: wire up the real Bing Autosuggest v7 endpoint when a key is provided.
  // Endpoint: https://api.bing.microsoft.com/v7.0/Suggestions?q=<seed>
  // Headers: Ocp-Apim-Subscription-Key: <BING_API_KEY>
  console.warn('[content-radar] BING_API_KEY configured but real fetch not yet implemented. Returning [].');
  return [];
}

export { BING_API_KEY };
