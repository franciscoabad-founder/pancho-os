export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull, hoyGuayaquil, isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { registrarEvento } from '../../../lib/juego/motor';

const TIPOS = ['gym', 'caminata', 'cardio', 'movilidad', 'estiramiento'];
const TIPOS_SET = ['warmup', 'working', 'dropset', 'superset', 'amrap', 'failure'];

// Inserta la lista de sets de una sesión (reemplaza los existentes).
async function guardarSets(sb: ReturnType<typeof getSupabaseServer>, sesionId: string, sets: unknown) {
  if (!Array.isArray(sets)) return;
  await sb.from('sets_log').delete().eq('sesion_id', sesionId);
  if (!sets.length) return;
  const filas = sets.map((s: Record<string, unknown>, i: number) => ({
    sesion_id: sesionId,
    ejercicio_id: s.ejercicio_id,
    orden: typeof s.orden === 'number' ? s.orden : i,
    tipo_set: TIPOS_SET.includes(String(s.tipo_set)) ? s.tipo_set : 'working',
    reps: numOrNull(s.reps),
    peso_kg: numOrNull(s.peso_kg),
    rpe: numOrNull(s.rpe),
    completado: !!s.completado,
  }));
  const { error } = await sb.from('sets_log').insert(filas);
  if (error) throw error;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();
    const id = url.searchParams.get('id');
    const sel = '*, sets_log(*, ejercicio:ejercicios(id,nombre,patron,grupo_muscular_primario))';
    if (id) {
      const { data, error } = await sb.from('sesiones').select(sel).eq('id', id).single();
      if (error) throw error;
      return json({ sesion: data });
    }
    const limite = Number(url.searchParams.get('limit')) || 100;
    const { data, error } = await sb
      .from('sesiones')
      .select(sel)
      .order('fecha', { ascending: false })
      .limit(limite);
    if (error) throw error;
    return json({ sesiones: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = await context.request.json();
    const tipo = body.tipo?.trim() || 'gym';
    if (!TIPOS.includes(tipo)) return json({ error: `tipo inválido` }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('sesiones')
      .insert([{
        fecha: body.fecha?.trim() || hoyGuayaquil(),
        rutina_id: body.rutina_id || null,
        tipo,
        duracion_min: numOrNull(body.duracion_min),
        notas: body.notas?.trim() || null,
        rpe_sesion: numOrNull(body.rpe_sesion),
        source: body.source?.trim() || 'manual',
        inicio: body.inicio?.trim() || null,
        fin: body.fin?.trim() || null,
      }])
      .select()
      .single();
    if (error) throw error;
    await guardarSets(sb, data.id, body.sets);
    registrarEvento(sb, { tipo: 'sesion_gym', ref_tabla: 'sesiones', ref_id: data.id }).catch(() => null);
    const { data: full } = await sb
      .from('sesiones')
      .select('*, sets_log(*, ejercicio:ejercicios(id,nombre,patron,grupo_muscular_primario))')
      .eq('id', data.id)
      .single();
    return json({ sesion: full ?? data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await context.request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const c of ['notas', 'fecha']) if (c in body) patch[c] = body[c]?.trim?.() ?? body[c];
    if ('tipo' in body) {
      if (!TIPOS.includes(body.tipo)) return json({ error: 'tipo inválido' }, 400);
      patch.tipo = body.tipo;
    }
    for (const c of ['duracion_min', 'rpe_sesion']) if (c in body) patch[c] = numOrNull(body[c]);
    for (const c of ['inicio', 'fin', 'rutina_id']) if (c in body) patch[c] = body[c] || null;
    const sb = getSupabaseServer();
    const { error } = await sb.from('sesiones').update(patch).eq('id', id);
    if (error) throw error;
    if ('sets' in body) await guardarSets(sb, id, body.sets);
    const { data: full } = await sb
      .from('sesiones')
      .select('*, sets_log(*, ejercicio:ejercicios(id,nombre,patron,grupo_muscular_primario))')
      .eq('id', id)
      .single();
    return json({ sesion: full });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('sesiones').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
