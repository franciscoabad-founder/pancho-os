// Query normalizer and deduplicator.

import type { RadarQuery, RawRadarQuery } from './types.ts';

/** Removes diacritics, punctuation and normalizes whitespace/lowercase. */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Canonical key used for deduplication. */
export function canonicalKey(q: string): string {
  return normalizeQuery(q);
}

/** Deduplicates queries while preserving the first seen original. */
export function deduplicateQueries<T extends { query: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = canonicalKey(item.query);
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

/** Checks if two queries are equivalent after normalization. */
export function areEquivalent(a: string, b: string): boolean {
  return canonicalKey(a) === canonicalKey(b);
}

/**
 * Deduplicates raw queries while preserving full source traceability:
 * a query seen in Google and YouTube comes back once, with both sources in
 * `sources` and `observedSources`. The first-seen original casing is kept.
 */
export function mergeQueries(items: RawRadarQuery[]): RadarQuery[] {
  const seen = new Map<string, RadarQuery>();
  for (const item of items) {
    const key = canonicalKey(item.query);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        query: item.query,
        original: item.original,
        source: item.source,
        sources: [item.source],
        observedSources: item.observed ? [item.source] : [],
        signalTypes: [item.signalType],
        observed: item.observed,
        generated: !item.observed,
        capturedAt: item.capturedAt,
        locale: item.locale,
        volume: item.volume ?? null,
        volumeSource: item.volumeSource ?? null,
        volumePeriod: item.volumePeriod ?? null,
        volumeUnit: item.volumeUnit ?? null,
      });
      continue;
    }
    if (!existing.sources!.includes(item.source)) existing.sources!.push(item.source);
    if (item.observed && !existing.observedSources!.includes(item.source)) {
      existing.observedSources!.push(item.source);
    }
    if (!existing.signalTypes!.includes(item.signalType)) existing.signalTypes!.push(item.signalType);
    existing.observed = existing.observed || item.observed;
    existing.generated = existing.generated || !item.observed;
    if (existing.volume == null && item.volume != null) {
      existing.volume = item.volume;
      existing.volumeSource = item.volumeSource ?? null;
      existing.volumePeriod = item.volumePeriod ?? null;
      existing.volumeUnit = item.volumeUnit ?? null;
    }
  }
  return Array.from(seen.values());
}
