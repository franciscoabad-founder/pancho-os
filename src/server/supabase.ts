// Cliente Supabase de servidor para el lado TanStack Start.
//
// Por que no se reusa src/lib/supabase.ts tal cual: esa version lee
// `import.meta.env.SUPABASE_URL`, que en Astro funciona porque el framework
// inyecta ahi todas las variables del .env. Vite NO hace eso: solo expone las
// que empiezan con VITE_, asi que en el build de Nitro
// `import.meta.env.SUPABASE_URL` queda como undefined y el cliente nunca se
// crea.
//
// La solucion ya establecida en este repo es readEnv() (process.env primero,
// import.meta.env como respaldo), el mismo helper que usan src/server/osAuth.ts
// y src/routes/api/mcp.ts. src/lib/supabase.ts se deja intacto porque las
// paginas de Astro todavia lo usan mientras conviven los dos runtimes.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readEnv } from '../lib/env.ts';

export function getSupabaseServer(): SupabaseClient {
  const url = readEnv('SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
