export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg } from '../../../lib/salud/apiHelpers';

// Reescribe la lista de ejercicios de una rutina (borra e inserta).
async function guardarEjercicios(sb: ReturnType<typeof getSupabaseServer>, rutinaId: string, ejercicios: unknown) {
  if (!Array.isArray(ejercicios)) return;
  await sb.from('rutina_ejercicios').delete().eq('rutina_id', rutinaId);
  if (!ejercicios.length) return;
  const filas = ejercicios.map((e: Record<string, unknown>, i: number) => ({
    rutina_id: rutinaId,
    ejercicio_id: e.ejercicio_id,
    orden: typeof e.orden === 'number' ? e.orden : i,
    sets_plan: Array.isArray(e.sets_plan) ? e.sets_plan : [],
  }));
  const { error } = await sb.from('rutina_ejercicios').insert(filas);
  if (error) throw error;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();
    const id = url.searchParams.get('id');
    // Detalle: rutina + ejercicios con datos del ejercicio.
    const sel = '*, rutina_ejercicios(*, ejercicio:ejercicios(*))';
    if (id) {
      const { data, error } = await sb.from('rutinas').select(sel).eq('id', id).single();
      if (error) throw error;
      return json({ rutina: data });
    }
    const { data, error } = await sb
      .from('rutinas')
      .select(sel)
      .eq('archivada', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ rutinas: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('rutinas')
      .insert([{
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        dias: Array.isArray(body.dias) ? body.dias : [],
      }])
      .select()
      .single();
    if (error) throw error;
    await guardarEjercicios(sb, data.id, body.ejercicios);
    // Devuelve la rutina completa.
    const { data: full } = await sb
      .from('rutinas')
      .select('*, rutina_ejercicios(*, ejercicio:ejercicios(*))')
      .eq('id', data.id)
      .single();
    return json({ rutina: full ?? data }, 201);
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
    for (const c of ['nombre', 'descripcion']) {
      if (c in body) patch[c] = typeof body[c] === 'string' ? body[c].trim() || null : body[c];
    }
    if ('dias' in body) patch.dias = Array.isArray(body.dias) ? body.dias : [];
    if ('archivada' in body) patch.archivada = !!body.archivada;
    const sb = getSupabaseServer();
    const { error } = await sb.from('rutinas').update(patch).eq('id', id);
    if (error) throw error;
    if ('ejercicios' in body) await guardarEjercicios(sb, id, body.ejercicios);
    const { data: full } = await sb
      .from('rutinas')
      .select('*, rutina_ejercicios(*, ejercicio:ejercicios(*))')
      .eq('id', id)
      .single();
    return json({ rutina: full });
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
    // rutina_ejercicios cae por ON DELETE CASCADE.
    const { error } = await sb.from('rutinas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
