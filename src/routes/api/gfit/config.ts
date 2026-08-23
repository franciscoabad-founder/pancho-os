// Server route de la config de GFIT (unidad de peso), portado de
// src/pages/api/gfit/config.ts (Astro) a TanStack Start. Mismo molde que dias.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { errMsg } from '../../../lib/salud/apiHelpers.ts';

const UNIDADES = ['kg', 'lb'];

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// unidad_peso vive en salud_config (fila única, compartida con el módulo Salud):
// mismo patrón de "leer o crear" que api/os/salud/config.ts.
async function getConfig() {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('salud_config')
    .select('id, unidad_peso')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (data && data.length) return data[0];
  const { data: created, error: insErr } = await sb
    .from('salud_config')
    .insert([{}])
    .select('id, unidad_peso')
    .single();
  if (insErr) throw insErr;
  return created;
}

export const Route = createFileRoute('/api/gfit/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const config = await getConfig();
          return json({ unidad_peso: config.unidad_peso ?? 'kg' });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = await request.json();
          if (!UNIDADES.includes(body.unidad_peso)) return json({ error: 'unidad_peso inválida (kg|lb)' }, 400);
          const current = await getConfig();
          const sb = getSupabaseServer();
          const { data, error } = await sb
            .from('salud_config')
            .update({ unidad_peso: body.unidad_peso, updated_at: new Date().toISOString() })
            .eq('id', current.id)
            .select('id, unidad_peso')
            .single();
          if (error) throw error;
          return json({ unidad_peso: data.unidad_peso });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
