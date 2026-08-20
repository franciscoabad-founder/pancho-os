// Opportunity scorer: produces an explainable score from local signals only.
// No external volume data is used. The score is a heuristic, not a traffic estimate.

import type { Intent, ScoreBreakdown } from './types.ts';

export interface ScorerInput {
  query: string;
  seed: string;
  intent: Intent;
  source: string;
  clusterSize: number;
  totalQueries: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Signal: how often the query appears across sources / variations. */
function scoreSignal(clusterSize: number, totalQueries: number): number {
  if (totalQueries <= 0) return 0;
  return clamp01(clusterSize / totalQueries);
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
  signal: 0.25,
  relevance: 0.25,
  authority: 0.15,
  repurposing: 0.2,
  saturation: 0.15,
} as const;

/** Computes an explainable opportunity score (0..1). */
export function scoreOpportunity(input: ScorerInput): { score: number; breakdown: ScoreBreakdown } {
  const signal = scoreSignal(input.clusterSize, input.totalQueries);
  const relevance = scoreRelevance(input.query, input.seed);
  const authority = scoreAuthority(input.source);
  const repurposing = scoreRepurposing(input.intent);
  const saturation = scoreSaturation(input.query);

  const score =
    WEIGHTS.signal * signal +
    WEIGHTS.relevance * relevance +
    WEIGHTS.authority * authority +
    WEIGHTS.repurposing * repurposing +
    WEIGHTS.saturation * (1 - saturation); // invert saturation: less saturation = better

  const explanation: string[] = [
    `Senal de aparicion: ${(signal * 100).toFixed(0)}% (cluster ${input.clusterSize} de ${input.totalQueries} consultas).`,
    `Relevancia tematica: ${(relevance * 100).toFixed(0)}% (tokens de '${input.seed}' presentes).`,
    `Autoridad de fuente: ${(authority * 100).toFixed(0)}% (fuente '${input.source}').`,
    `Potencial de repurposing: ${(repurposing * 100).toFixed(0)}% (intencion '${input.intent}').`,
    `Saturacion: ${(saturation * 100).toFixed(0)}% (longitud ${input.query.split(/\s+/).filter(Boolean).length} palabras; menor saturacion favorece).`,
  ];

  return {
    score: clamp01(score),
    breakdown: { signal, relevance, authority, repurposing, saturation, explanation },
  };
}

export { WEIGHTS };
