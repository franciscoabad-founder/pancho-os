// Query normalizer and deduplicator.

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
