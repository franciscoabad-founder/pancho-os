// Content Radar domain types. Pure data shapes for seed -> variations -> intents -> opportunities.
//
// Two kinds of queries flow through the pipeline:
//   1. Generated locally (source 'local', observed=false, generated=true).
//   2. Observed in an external source (observed=true, generated=false unless the
//      local generator also produced it).
// Both are always distinguishable via observed/generated and sources/observedSources.

export const INTENTS = [
  'aprender',
  'resolver',
  'comparar',
  'comprar',
  'evaluar-riesgos',
  'buscar-ejemplos',
  'opinion-controversia',
] as const;
export type Intent = (typeof INTENTS)[number];

export const SOURCE_KINDS = ['local', 'google', 'bing', 'youtube'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

// What kind of signal produced the query. 'generated' = local generator, never observed.
export const SIGNAL_TYPES = [
  'generated',
  'autocomplete-suggestion',
  'related-search-query',
  'related-video-topic',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export type SourceStatusState = 'ready' | 'ok' | 'empty' | 'error' | 'disabled';

/** Sanitized per-source status. Never contains credentials, tokens or full URLs with secrets. */
export interface SourceStatus {
  id: SourceKind;
  label: string;
  configured: boolean;
  available: boolean;
  status: SourceStatusState;
  resultCount: number;
  reason?: string;
  setupInstructions?: string;
  /** Logical endpoint description, safe to show (no keys, no query secrets). */
  endpoint?: string;
}

export interface RadarQueryInput {
  seed: string;
  lang?: string;
  country?: string;
  sources?: SourceKind[];
  options?: {
    /** Per-source fetch timeout in ms. Clamped to [500, 20000]. */
    timeoutMs?: number;
  };
}

/** A raw query as produced by a single source before merging. */
export interface RawRadarQuery {
  query: string;
  original: string;
  source: SourceKind;
  signalType: SignalType;
  observed: boolean;
  capturedAt?: string;
  locale?: string;
  volume?: number | null;
  volumeSource?: string | null;
  volumePeriod?: string | null;
  volumeUnit?: string | null;
}

/**
 * A deduplicated query. `source` is the first source that produced it;
 * `sources`/`observedSources` preserve full traceability across sources.
 * The optional fields are absent only in hand-built raw literals (tests).
 */
export interface RadarQuery {
  query: string;
  source: SourceKind;
  original: string;
  sources?: SourceKind[];
  observedSources?: SourceKind[];
  signalTypes?: SignalType[];
  observed?: boolean;
  generated?: boolean;
  capturedAt?: string;
  locale?: string;
  volume?: number | null;
  volumeSource?: string | null;
  volumePeriod?: string | null;
  volumeUnit?: string | null;
}

export interface ScoreBreakdown {
  observedSignal: number;
  relevance: number;
  authority: number;
  repurposing: number;
  saturation: number;
  explanation: string[];
}

export interface RadarOpportunity {
  query: string;
  original: string;
  source: SourceKind;
  sources: SourceKind[];
  observedSources: SourceKind[];
  signalTypes: SignalType[];
  /** 'observed' = only external, 'generated' = only local, 'mixed' = both. */
  sourceType: 'observed' | 'generated' | 'mixed';
  observed: boolean;
  generated: boolean;
  intent: Intent;
  cluster: string;
  opportunityScore: number;
  scoreBreakdown: ScoreBreakdown;
  suggestedFormats: string[];
  suggestedPlatforms: string[];
  locale: string;
  language: string;
  capturedAt: string;
  volume: number | null;
  volumeSource: string | null;
  volumePeriod: string | null;
  volumeUnit: string | null;
  warnings: string[];
}

export interface RadarRunResult {
  seed: string;
  lang: string;
  country: string;
  queries: RadarQuery[];
  opportunities: RadarOpportunity[];
  sourceStatuses: SourceStatus[];
  sourcesUsed: SourceKind[];
  warnings: string[];
  generatedAt: string;
}

export interface ContentIdeaInsert {
  titulo: string;
  formato: string | null;
  idea_madre: string | null;
  repurposing: string[];
  status: string;
  plataformas: string[];
  fecha_target: string | null;
  url_referencia?: string | null;
  transcript?: string | null;
  source_query?: string | null;
  intent?: string | null;
  opportunity_score?: number | null;
  source?: string | null;
  cluster?: string | null;
  suggested_formats?: string[] | null;
  suggested_platforms?: string[] | null;
  observed_sources?: string[] | null;
  captured_at?: string | null;
  source_metadata?: Record<string, unknown> | null;
}
