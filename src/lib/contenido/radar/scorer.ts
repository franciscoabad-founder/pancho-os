// Opportunity scorer: produces an explainable score from local + observed signals.
// Honesty rules:
// - observedSignal is 0.1 for locally-generated-only queries: generation is not demand.
// - Observed queries score by how many external sources saw them.
// - Real volume (when a source provides it) boosts observedSignal on a log scale
//   and is always attributed (volumeSource / volumePeriod / volumeUnit).
// The score is a heuristic, not a traffic estimate, unless volume is present.

import type { Intent, ScoreBreakdown } from './types.ts';

export interface ScorerInput {
  query: string;
  seed: string;
  intent: Intent;
  source: string;
  clusterSize: number;
  totalQueries: number;
  observedSources?: string[];
  volume?: number | null;
  volumeSource?: string | null;
  volumePeriod?: string | null;
  volumeUnit?: string | null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Observed signal: was the query actually seen in external sources?
 * 0.1 = only generated locally; 0.5/0.7/0.9 = seen in 1/2/3+ sources.
 * Real volume overrides on a log scale.
 */
function scoreObservedSignal(input: ScorerInput): number {
  if (input.volume != null && input.volume > 0) {
    return clamp01(0.6 + Math.log10(input.volume + 1) / 10);
  }
  const n = input.observedSources?.length ?? 0;
  if (n === 0) return 0.1;
  return clamp01(0.5 + 0.2 * (n - 1));
}

function explainObservedSignal(input: ScorerInput, value: number): string {
  const pct = `${(value * 100).toFixed(0)}%`;
  if (input.volume != null && input.volume > 0) {
    const unit = input.volumeUnit ?? 'unidades';
    const source = input.volumeSource ?? 'fuente externa';
    const period = input.volumePeriod ? `, periodo ${input.volumePeriod}` : '';
    return `Senal observada: ${pct} (volumen real ${input.volume} ${unit} segun ${source}${period}).`;
  }
  const observed = input.observedSources ?? [];
  if (observed.length === 0) {
    return `Senal observada: ${pct} (consulta generada localmente; no observada en buscadores). Senal cualitativa, sin datos de volumen.`;
  }
  return `Senal observada: ${pct} (observada en ${observed.length} fuente(s): ${observed.join(', ')}). Sin volumen real: senal cualitativa.`;
}

/** Relevance: seed tokens present in the query. */
function scoreRelevance(query: string, seed: string): number {
  const seedTokens = new Set(seed.toLowerCase().split(/\s+/).filter(Boolean));
  if (seedTokens.size === 0) return 0;
  const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  let matched = 0;
  for (const t of queryTokens) {
    if (seedTokens.has(t)) matched++;
  }
  return clamp01(matched / seedTokens.size);
}

/** Authority: heuristic based on source reliability. */
function scoreAuthority(source: string): number {
  switch (source) {
    case 'google':
      return 0.9;
    case 'youtube':
      return 0.75;
    case 'bing':
      return 0.7;
    case 'local':
    default:
      return 0.5;
  }
}

/** Best authority across the sources that actually observed the query. */
function bestAuthority(input: ScorerInput): number {
  const observed = input.observedSources ?? [];
  if (observed.length === 0) return scoreAuthority(input.source);
  return Math.max(...observed.map(scoreAuthority));
}

/** Repurposing: intents that map well to multiple formats score higher. */
function scoreRepurposing(intent: Intent): number {
  switch (intent) {
    case 'aprender':
    case 'resolver':
    case 'buscar-ejemplos':
      return 0.9;
    case 'comparar':
    case 'opinion-controversia':
      return 0.75;
    case 'comprar':
    case 'evaluar-riesgos':
      return 0.6;
    default:
      return 0.5;
  }
}

/** Saturation: longer, more generic queries are more saturated. */
function scoreSaturation(query: string): number {
  const words = query.split(/\s+/).filter(Boolean).length;
  if (words <= 3) return 0.8;
  if (words <= 5) return 0.6;
  if (words <= 8) return 0.4;
  return 0.2;
}

const WEIGHTS = {
  observedSignal: 0.25,
  relevance: 0.25,
  authority: 0.15,
  repurposing: 0.2,
  saturation: 0.15,
} as const;

/** Computes an explainable opportunity score (0..1). */
export function scoreOpportunity(input: ScorerInput): { score: number; breakdown: ScoreBreakdown } {
  const observedSignal = scoreObservedSignal(input);
  const relevance = scoreRelevance(input.query, input.seed);
  const authority = bestAuthority(input);
  const repurposing = scoreRepurposing(input.intent);
  const saturation = scoreSaturation(input.query);

  const score =
    WEIGHTS.observedSignal * observedSignal +
    WEIGHTS.relevance * relevance +
    WEIGHTS.authority * authority +
    WEIGHTS.repurposing * repurposing +
    WEIGHTS.saturation * (1 - saturation); // invert saturation: less saturation = better

  const explanation: string[] = [
    explainObservedSignal(input, observedSignal),
    `Relevancia tematica: ${(relevance * 100).toFixed(0)}% (tokens de '${input.seed}' presentes).`,
    `Autoridad de fuente: ${(authority * 100).toFixed(0)}% (cluster ${input.clusterSize} de ${input.totalQueries} consultas).`,
    `Potencial de repurposing: ${(repurposing * 100).toFixed(0)}% (intencion '${input.intent}').`,
    `Saturacion: ${(saturation * 100).toFixed(0)}% (longitud ${input.query.split(/\s+/).filter(Boolean).length} palabras; menor saturacion favorece).`,
  ];

  return {
    score: clamp01(score),
    breakdown: { observedSignal, relevance, authority, repurposing, saturation, explanation },
  };
}

export { WEIGHTS };
