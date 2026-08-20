// Content Radar domain types. Pure data shapes for seed -> variations -> intents -> opportunities.

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

export interface RadarQueryInput {
  seed: string;
  lang?: string;
  country?: string;
  sources?: SourceKind[];
}

export interface RadarQuery {
  query: string;
  source: SourceKind;
  original: string;
}

export interface ScoreBreakdown {
  signal: number;
  relevance: number;
  authority: number;
  repurposing: number;
  saturation: number;
  explanation: string[];
}

export interface RadarOpportunity {
  query: string;
  source: SourceKind;
  original: string;
  intent: Intent;
  cluster: string;
  opportunityScore: number;
  scoreBreakdown: ScoreBreakdown;
  suggestedFormats: string[];
  suggestedPlatforms: string[];
}

export interface RadarRunResult {
  seed: string;
  queries: RadarQuery[];
  opportunities: RadarOpportunity[];
  sourcesUsed: SourceKind[];
  warnings: string[];
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
}
