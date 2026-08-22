// Environment reader that works in Astro SSR (import.meta.env), plain Node
// (process.env) and under `node --test` (where import.meta.env is undefined).
// Credentials are read lazily per call, never cached at module top-level, so
// tests can set/unset process.env between cases.
//
// Vivia en src/lib/contenido/radar/env.ts por accidente historico: nacio con el
// Content Radar y despues lo adoptaron piezas del nucleo que no tienen nada que
// ver con contenido (src/server/osAuth.ts, src/server/supabase.ts,
// src/mcp/osTools.ts, src/routes/api/mcp.ts, src/routes/api/os-auth.ts). Al
// convertir Contenido en organo (src/organs/contenido/**) eso habria dejado a
// la autenticacion del OS dependiendo del organo de contenido, que es
// exactamente lo que la estructura modular busca evitar. Se movio aca, a
// infraestructura compartida, SIN un solo cambio de logica: es el mismo
// archivo, misma funcion, mismo comportamiento. Solo cambio de casa.

export function readEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  const fromMeta = metaEnv?.[name];
  return fromMeta ? fromMeta : undefined;
}
