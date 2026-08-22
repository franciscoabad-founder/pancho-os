// Content Radar orchestrator:
// generate (local) -> fetch (external adapters, parallel, per-source timeout)
// -> merge with source traceability -> classify -> cluster -> score -> sort.
// A failed or unconfigured source never breaks the run; its status is reported
// in sourceStatuses and (for errors) in warnings.

import type {
  RadarQueryInput,
  RadarQuery,
  RadarOpportunity,
  RadarRunResult,
  RawRadarQuery,
  SourceKind,
  SourceStatus,
  Intent,
} from './types.ts';
import { SOURCE_KINDS } from './types.ts';
import { generateLocalQueries, suggestedFormatsForIntent, suggestedPlatformsForIntent } from './generator.ts';
import { deduplicateQueries, mergeQueries } from './normalizer.ts';
import { classifyIntent } from './intent.ts';
import { scoreOpportunity } from './scorer.ts';
import { clusterId, clusterLabel } from './cluster.ts';
import { getAdapter } from './sources/index.ts';

const ALL_SOURCES: readonly SourceKind[] = SOURCE_KINDS;
const DEFAULT_TIMEOUT_MS = 8000;

function clampTimeout(ms: number | undefined): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return DEFAULT_TIMEOUT_MS;
  return Math.max(500, Math.min(20000, Math.round(ms)));
}

function sanitizeSources(sources: SourceKind[] | undefined): SourceKind[] {
  if (!sources || sources.length === 0) return [...ALL_SOURCES];
  const valid = sources.filter((s): s is SourceKind => (SOURCE_KINDS as readonly string[]).includes(s));
  return valid.length > 0 ? Array.from(new Set(valid)) : [...ALL_SOURCES];
}

/** Runs the full radar pipeline. */
export async function runRadar(input: RadarQueryInput): Promise<RadarRunResult> {
  const seed = input.seed.trim();
  const lang = typeof input.lang === 'string' && input.lang.trim() ? input.lang.trim() : 'es';
  const country = typeof input.country === 'string' && input.country.trim() ? input.country.trim() : 'Ecuador';
  const sources = sanitizeSources(input.sources);
  const timeoutMs = clampTimeout(input.options?.timeoutMs);
  const generatedAt = new Date().toISOString();
  const locale = `${lang}-${country}`;

  const warnings: string[] = [];
  const sourcesUsed: SourceKind[] = [];
  const raw: RawRadarQuery[] = [];
  const statusBySource = new Map<SourceKind, SourceStatus>();

  // 1. Local generator (selected by default; runs without any credentials).
  if (sources.includes('local')) {
    const localQueries = seed ? generateLocalQueries({ seed, country }) : [];
    for (const q of localQueries) {
      raw.push({
        query: q,
        original: q,
        source: 'local',
        signalType: 'generated',
        observed: false,
        capturedAt: generatedAt,
        locale,
      });
    }
    statusBySource.set('local', {
      id: 'local',
      label: 'Generador local',
      configured: true,
      available: true,
      status: localQueries.length > 0 ? 'ok' : 'empty',
      resultCount: localQueries.length,
      endpoint: 'local (sin red)',
    });
    if (localQueries.length > 0) sourcesUsed.push('local');
  }

  // 2. External adapters in parallel. Each adapter owns its timeout and error
  //    handling; a failure lands in sourceStatuses + warnings, never throws.
  const externalSources = sources.filter((s) => s !== 'local');
  if (seed) {
    await Promise.all(
      externalSources.map(async (id) => {
        const adapter = getAdapter(id);
        if (!adapter) return;
        if (!adapter.isConfigured()) {
          statusBySource.set(id, {
            id,
            label: adapter.label,
            configured: false,
            available: false,
            status: 'disabled',
            resultCount: 0,
            reason: `${adapter.envVar} no configurada`,
            setupInstructions: adapter.setupInstructions,
            endpoint: adapter.endpoint,
          });
          return;
        }
        const res = await adapter.fetchSuggestions({ seed, lang, country, timeoutMs });
        statusBySource.set(id, {
          id,
          label: adapter.label,
          configured: true,
          available: true,
          status: res.status === 'disabled' ? 'disabled' : res.status,
          resultCount: res.queries.length,
          reason: res.error,
          endpoint: adapter.endpoint,
        });
        if (res.status === 'error') {
          warnings.push(`${adapter.label}: ${res.error ?? 'error desconocido'}`);
        }
        if (res.queries.length > 0) {
          raw.push(...res.queries);
          sourcesUsed.push(id);
        }
      }),
    );
  } else {
    for (const id of externalSources) {
      const adapter = getAdapter(id);
      if (!adapter) continue;
      statusBySource.set(id, {
        id,
        label: adapter.label,
        configured: adapter.isConfigured(),
        available: adapter.isConfigured(),
        status: 'empty',
        resultCount: 0,
        endpoint: adapter.endpoint,
      });
    }
  }

  // 3. Merge: dedupe while keeping every source where each query appeared.
  const merged = mergeQueries(raw);

  // 4. Cluster sizes per intent.
  const clusterMap = new Map<string, number>();
  for (const q of merged) {
    const intent = classifyIntent(q.query);
    const cid = clusterId(intent, seed);
    clusterMap.set(cid, (clusterMap.get(cid) ?? 0) + 1);
  }

  // 5. Score + label each merged query.
  const opportunities: RadarOpportunity[] = merged.map((q) => {
    const intent = classifyIntent(q.query);
    const cid = clusterId(intent, seed);
    const clusterSize = clusterMap.get(cid) ?? 1;
    const observedSources = q.observedSources ?? [];
    const { score, breakdown } = scoreOpportunity({
      query: q.query,
      seed,
      intent,
      source: q.source,
      clusterSize,
      totalQueries: merged.length,
      observedSources,
      volume: q.volume ?? null,
      volumeSource: q.volumeSource ?? null,
      volumePeriod: q.volumePeriod ?? null,
      volumeUnit: q.volumeUnit ?? null,
    });
    const observed = observedSources.length > 0;
    const generated = q.generated ?? q.sources?.includes('local') ?? q.source === 'local';
    return {
      query: q.query,
      original: q.original,
      source: q.source,
      sources: q.sources ?? [q.source],
      observedSources,
      signalTypes: q.signalTypes ?? [],
      sourceType: observed && generated ? 'mixed' : observed ? 'observed' : 'generated',
      observed,
      generated,
      intent,
      cluster: clusterLabel(intent, seed),
      opportunityScore: Number(score.toFixed(3)),
      scoreBreakdown: breakdown,
      suggestedFormats: suggestedFormatsForIntent(intent),
      suggestedPlatforms: suggestedPlatformsForIntent(intent),
      locale: q.locale ?? locale,
      language: lang,
      capturedAt: q.capturedAt ?? generatedAt,
      volume: q.volume ?? null,
      volumeSource: q.volumeSource ?? null,
      volumePeriod: q.volumePeriod ?? null,
      volumeUnit: q.volumeUnit ?? null,
      warnings: [],
    };
  });

  // 6. Sort by opportunity score descending.
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  const sourceStatuses = ALL_SOURCES.filter((s) => statusBySource.has(s)).map(
    (s) => statusBySource.get(s)!,
  );

  return {
    seed,
    lang,
    country,
    queries: merged,
    opportunities,
    sourceStatuses,
    sourcesUsed,
    warnings,
    generatedAt,
  };
}

export type {
  RadarQueryInput,
  RadarQuery,
  RawRadarQuery,
  RadarOpportunity,
  RadarRunResult,
  SourceKind,
  SourceStatus,
  SignalType,
  Intent,
} from './types.ts';
export { INTENTS, SOURCE_KINDS, SIGNAL_TYPES } from './types.ts';
export { generateLocalQueries, suggestedFormatsForIntent, suggestedPlatformsForIntent } from './generator.ts';
export { normalizeQuery, deduplicateQueries, mergeQueries } from './normalizer.ts';
export { classifyIntent } from './intent.ts';
export { scoreOpportunity } from './scorer.ts';
export { clusterId, clusterLabel } from './cluster.ts';
export { describeSources, getAdapter, listAdapters } from './sources/index.ts';
