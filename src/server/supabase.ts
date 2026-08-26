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
  // Las nuevas secret keys (`sb_secret_...`) son opacas, no JWT. supabase-js
  // añade por defecto la key tanto en `apikey` como en `Authorization: Bearer`;
  // Supabase intenta parsear este segundo header como JWT y rechaza la request.
  // El backend ya usa la key solo para acceso admin, así que preservamos el
  // `apikey` y retiramos únicamente ese Bearer inválido de cada request.
  const fetchConSecretKey = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.delete('authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  };

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchConSecretKey },
  });
}
