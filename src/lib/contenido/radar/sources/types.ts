// Source adapter contract. Every external source implements SourceAdapter.
// Rules:
// - isConfigured() only checks credential presence; it never proves connectivity.
// - fetchSuggestions() never throws: failures come back as status 'error' with a
//   sanitized message (no API keys, no headers, no URLs containing secrets).
// - A source without credentials returns status 'disabled' without any fetch.

import type { RawRadarQuery, SignalType, SourceKind } from '../types.ts';

export interface SourceFetchInput {
  seed: string;
  lang: string;
  country: string;
  timeoutMs: number;
}

export interface SourceRunResult {
  status: 'ok' | 'empty' | 'error' | 'disabled';
  queries: RawRadarQuery[];
  /** Sanitized, human-readable. Never includes credentials or secret-bearing URLs. */
  error?: string;
}

export interface SourceAdapter {
  id: SourceKind;
  label: string;
  signalType: SignalType;
  /** Logical endpoint description safe to display (no key material). */
  endpoint: string;
  envVar: string;
  setupInstructions: string;
  isConfigured(): boolean;
  fetchSuggestions(input: SourceFetchInput): Promise<SourceRunResult>;
}

export function disabledResult(): SourceRunResult {
  return { status: 'disabled', queries: [] };
}

export function errorResult(error: string): SourceRunResult {
  return { status: 'error', queries: [], error };
}

export function okResult(queries: RawRadarQuery[]): SourceRunResult {
  return { status: queries.length > 0 ? 'ok' : 'empty', queries };
}
