// Pure validation for radar promotion payloads. The API never trusts the
// browser: every field is type-checked, bounded and whitelisted here before
// anything reaches Supabase.

import { INTENTS, SOURCE_KINDS, type Intent, type SourceKind } from './types.ts';

export const MAX_QUERY_LENGTH = 200;
export const MAX_LIST_ITEMS = 10;
export const MAX_LIST_ITEM_LENGTH = 60;
export const MAX_CLUSTER_LENGTH = 120;

export interface ValidatedPromotion {
  query: string;
  original: string;
  intent: Intent;
  cluster: string | null;
  opportunityScore: number;
  source: SourceKind;
  sources: SourceKind[];
  observedSources: SourceKind[];
  observed: boolean;
  generated: boolean;
  sourceType: 'observed' | 'generated' | 'mixed';
  suggestedFormats: string[];
  suggestedPlatforms: string[];
  capturedAt: string | null;
  volume: number | null;
  volumeSource: string | null;
  volumePeriod: string | null;
  volumeUnit: string | null;
}

export type PromotionValidation =
  | { ok: true; value: ValidatedPromotion }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, MAX_LIST_ITEM_LENGTH))
    .filter((x) => x.length > 0)
    .slice(0, MAX_LIST_ITEMS);
}

function sanitizeSourceList(v: unknown): SourceKind[] {
  if (!Array.isArray(v)) return [];
  const valid = v.filter(
    (x): x is SourceKind => typeof x === 'string' && (SOURCE_KINDS as readonly string[]).includes(x),
  );
  return Array.from(new Set(valid));
}

function shortString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/** Validates body.opportunity from POST /api/os/contenido/radar/promote. */
export function validatePromotionPayload(body: unknown): PromotionValidation {
  if (!isRecord(body) || !isRecord(body.opportunity)) {
    return { ok: false, error: 'opportunity requerida' };
  }
  const opp = body.opportunity;

  const query = typeof opp.query === 'string' ? opp.query.trim() : '';
  if (!query) return { ok: false, error: 'opportunity.query requerida' };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `query demasiado larga (max ${MAX_QUERY_LENGTH} caracteres)` };
  }

  if (typeof opp.intent !== 'string' || !(INTENTS as readonly string[]).includes(opp.intent)) {
    return { ok: false, error: `intent invalido; permitidos: ${INTENTS.join(', ')}` };
  }

  const score = opp.opportunityScore;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
    return { ok: false, error: 'opportunityScore debe ser un numero entre 0 y 1' };
  }

  const sources = sanitizeSourceList(opp.sources);
  const observedSources = sanitizeSourceList(opp.observedSources).filter((s) => s !== 'local');
  const source: SourceKind =
    typeof opp.source === 'string' && (SOURCE_KINDS as readonly string[]).includes(opp.source)
      ? (opp.source as SourceKind)
      : observedSources[0] ?? sources[0] ?? 'local';

  const mergedSources = Array.from(new Set<SourceKind>([source, ...sources]));
  const observed = observedSources.length > 0;
  const generated =
    opp.generated === true || mergedSources.includes('local');

  const capturedAt = shortString(opp.capturedAt, 40);
  if (capturedAt && Number.isNaN(Date.parse(capturedAt))) {
    return { ok: false, error: 'capturedAt no es una fecha ISO valida' };
  }

  let volume: number | null = null;
  if (opp.volume !== null && opp.volume !== undefined) {
    if (typeof opp.volume !== 'number' || !Number.isFinite(opp.volume) || opp.volume < 0) {
      return { ok: false, error: 'volume debe ser un numero >= 0 o null' };
    }
    volume = opp.volume;
  }

  return {
    ok: true,
    value: {
      query,
      original: shortString(opp.original, MAX_QUERY_LENGTH) ?? query,
      intent: opp.intent as Intent,
      cluster: shortString(opp.cluster, MAX_CLUSTER_LENGTH),
      opportunityScore: score,
      source,
      sources: mergedSources,
      observedSources,
      observed,
      generated,
      sourceType: observed && generated ? 'mixed' : observed ? 'observed' : 'generated',
      suggestedFormats: sanitizeStringList(opp.suggestedFormats),
      suggestedPlatforms: sanitizeStringList(opp.suggestedPlatforms),
      capturedAt,
      volume,
      volumeSource: shortString(opp.volumeSource, 60),
      volumePeriod: shortString(opp.volumePeriod, 60),
      volumeUnit: shortString(opp.volumeUnit, 30),
    },
  };
}
