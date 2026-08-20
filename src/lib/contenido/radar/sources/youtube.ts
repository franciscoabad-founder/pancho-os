// YouTube autocomplete adapter. Opt-in: requires YOUTUBE_API_KEY.
// Without a key it returns [] and the radar continues with the local generator.

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Fetches YouTube autocomplete suggestions.
 * Requires YOUTUBE_API_KEY. If not set, returns empty array.
 */
export async function fetchYouTubeSuggestions(seed: string): Promise<string[]> {
  if (!YOUTUBE_API_KEY) return [];
  // Placeholder: YouTube does not offer an official autocomplete API.
  // You can integrate a third-party suggest service or YouTube Data API search here.
  console.warn('[content-radar] YOUTUBE_API_KEY configured but no official autocomplete endpoint is implemented. Returning [].');
  return [];
}

export { YOUTUBE_API_KEY };
