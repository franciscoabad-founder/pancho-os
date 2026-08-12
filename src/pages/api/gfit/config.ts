export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg } from '../../../lib/salud/apiHelpers';

const UNIDADES = ['kg', 'lb'];

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

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const config = await getConfig();
    return json({ unidad_peso: config.unidad_peso ?? 'kg' });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
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
};
