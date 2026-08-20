// Content Radar orchestrator: generate -> fetch -> normalize -> dedupe -> classify -> score -> cluster.

import type {
  RadarQueryInput,
  RadarQuery,
  RadarOpportunity,
  RadarRunResult,
  SourceKind,
  Intent,
} from './types.ts';
import { generateLocalQueries, suggestedFormatsForIntent, suggestedPlatformsForIntent } from './generator.ts';
import { deduplicateQueries } from './normalizer.ts';
import { classifyIntent } from './intent.ts';
import { scoreOpportunity } from './scorer.ts';
import { clusterId, clusterLabel } from './cluster.ts';
import { fetchGoogleSuggestions } from './sources/google.ts';
import { fetchBingSuggestions } from './sources/bing.ts';
import { fetchYouTubeSuggestions } from './sources/youtube.ts';

const ALL_SOURCES: readonly SourceKind[] = ['local', 'google', 'bing', 'youtube'];

interface SourceFetchResult {
  source: SourceKind;
  queries: string[];
  warning?: string;
}

async function fetchFromSource(source: SourceKind, seed: string): Promise<SourceFetchResult> {
  try {
    let queries: string[] = [];
    if (source === 'google') queries = await fetchGoogleSuggestions(seed);
    else if (source === 'bing') queries = await fetchBingSuggestions(seed);
    else if (source === 'youtube') queries = await fetchYouTubeSuggestions(seed);
    return { source, queries };
  } catch (err) {
    return { source, queries: [], warning: `Error en ${source}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Runs the full radar pipeline. */
export async function runRadar(input: RadarQueryInput): Promise<RadarRunResult> {
  const seed = input.seed.trim();
  const lang = input.lang ?? 'es';
  const country = input.country ?? 'Ecuador';
  const sources = input.sources && input.sources.length > 0 ? input.sources : [...ALL_SOURCES];

  const warnings: string[] = [];
  const sourcesUsed: SourceKind[] = [];
  const allQueries: RadarQuery[] = [];

  // Local generator always runs
  if (sources.includes('local')) {
    const localQueries = generateLocalQueries({ seed, country });
    for (const q of localQueries) {
      allQueries.push({ query: q, source: 'local', original: q });
    }
    sourcesUsed.push('local');
  }

  // External sources (opt-in, async)
  const externalSources = sources.filter((s) => s !== 'local');
  const fetchResults = await Promise.all(externalSources.map((s) => fetchFromSource(s, seed)));
  for (const res of fetchResults) {
    if (res.warning) warnings.push(res.warning);
    if (res.queries.length > 0) {
      for (const q of res.queries) {
        allQueries.push({ query: q, source: res.source, original: q });
      }
      sourcesUsed.push(res.source);
    }
  }

  // Deduplicate preserving first-seen original
  const deduped = deduplicateQueries(allQueries);

  // Group by intent + seed stem for cluster size
  const clusterMap = new Map<string, number>();
  for (const q of deduped) {
    const intent = classifyIntent(q.query);
    const cid = clusterId(intent, seed);
    clusterMap.set(cid, (clusterMap.get(cid) ?? 0) + 1);
  }

  const opportunities: RadarOpportunity[] = deduped.map((q) => {
    const intent = classifyIntent(q.query);
    const cid = clusterId(intent, seed);
    const clusterSize = clusterMap.get(cid) ?? 1;
    const { score, breakdown } = scoreOpportunity({
      query: q.query,
      seed,
      intent,
      source: q.source,
      clusterSize,
      totalQueries: deduped.length,
    });
    return {
      query: q.query,
      source: q.source,
      original: q.original,
      intent,
      cluster: clusterLabel(intent, seed),
      opportunityScore: Number(score.toFixed(3)),
      scoreBreakdown: breakdown,
      suggestedFormats: suggestedFormatsForIntent(intent),
      suggestedPlatforms: suggestedPlatformsForIntent(intent),
    };
  });

  // Sort by score descending
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return {
    seed,
    queries: deduped,
    opportunities,
    sourcesUsed,
    warnings,
  };
}

export type { RadarQueryInput, RadarQuery, RadarOpportunity, RadarRunResult, SourceKind, Intent };
export { generateLocalQueries, suggestedFormatsForIntent, suggestedPlatformsForIntent } from './generator.ts';
export { normalizeQuery, deduplicateQueries } from './normalizer.ts';
export { classifyIntent } from './intent.ts';
export { scoreOpportunity } from './scorer.ts';
export { clusterId, clusterLabel } from './cluster.ts';
