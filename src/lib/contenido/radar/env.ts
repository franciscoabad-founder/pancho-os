// Environment reader that works in Astro SSR (import.meta.env), plain Node
// (process.env) and under `node --test` (where import.meta.env is undefined).
// Credentials are read lazily per call, never cached at module top-level, so
// tests can set/unset process.env between cases.

export function readEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  const fromMeta = metaEnv?.[name];
  return fromMeta ? fromMeta : undefined;
}
