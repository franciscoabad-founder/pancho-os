// Source adapters registry + sanitized status descriptions.

import type { SourceKind, SourceStatus } from '../types.ts';
import { googleAdapter } from './google.ts';
import { bingAdapter } from './bing.ts';
import { youtubeAdapter } from './youtube.ts';
import type { SourceAdapter } from './types.ts';

export type ExternalSourceKind = Exclude<SourceKind, 'local'>;

const ADAPTERS: Record<ExternalSourceKind, SourceAdapter> = {
  google: googleAdapter,
  bing: bingAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(id: SourceKind): SourceAdapter | undefined {
  if (id === 'local') return undefined;
  return ADAPTERS[id];
}

export function listAdapters(): SourceAdapter[] {
  return [googleAdapter, bingAdapter, youtubeAdapter];
}

/**
 * Sanitized configuration status for every source (local + external).
 * Safe to expose to the UI: contains no credential values, no headers,
 * no URLs with secrets.
 */
export function describeSources(): SourceStatus[] {
  const local: SourceStatus = {
    id: 'local',
    label: 'Generador local',
    configured: true,
    available: true,
    status: 'ready',
    resultCount: 0,
    endpoint: 'local (sin red)',
  };
  const externals = listAdapters().map((a): SourceStatus => {
    const configured = a.isConfigured();
    return {
      id: a.id,
      label: a.label,
      configured,
      available: configured,
      status: configured ? 'ready' : 'disabled',
      resultCount: 0,
      reason: configured ? undefined : `${a.envVar} no configurada`,
      setupInstructions: configured ? undefined : a.setupInstructions,
      endpoint: a.endpoint,
    };
  });
  return [local, ...externals];
}

export { googleAdapter, bingAdapter, youtubeAdapter };
export type { SourceAdapter, SourceFetchInput, SourceRunResult } from './types.ts';
