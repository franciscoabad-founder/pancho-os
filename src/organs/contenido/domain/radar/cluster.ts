// Simple clustering by intent + seed stem.

import type { Intent } from './types.ts';

function seedStem(seed: string): string {
  const s = seed.trim().toLowerCase();
  const words = s.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ') || s;
}

/** Produces a stable cluster id for grouping in the UI. */
export function clusterId(intent: Intent, seed: string): string {
  return `${intent}:${seedStem(seed)}`;
}

/** Human-readable cluster label. */
export function clusterLabel(intent: Intent, seed: string): string {
  return `${intent} / ${seedStem(seed)}`;
}
