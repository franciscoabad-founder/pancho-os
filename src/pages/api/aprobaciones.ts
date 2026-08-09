export const prerender = false;

// Backend de os_aprobaciones: gate de decisiones sensibles. Reemplaza el demo estatico
// `aprobacionesDefault` en os/data/sistema.ts, ahora persistido en Supabase.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const CAMPOS = ['titulo', 'contexto', 'opciones', 'recomendacion', 'estado'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    let query = sb.from('os_aprobaciones').select('*').order('created_at', { ascending: false });
    const estado = context.url.searchParams.get('estado');
    if (estado) query = query.eq('estado', estado);
    const { data, error } = await query;
    if (error) throw error;
    return json({ aprobaciones: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    if (!titulo) return json({ error: 'titulo requerido' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_aprobaciones')
      .insert([{
        titulo,
        contexto: body.contexto ?? null,
        opciones: Array.isArray(body.opciones) ? body.opciones : [],
        recomendacion: body.recomendacion ?? null,
        estado: ESTADOS.includes(body.estado) ? body.estado : 'pendiente',
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ aprobacion: data }, 201);
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
    if ('estado' in body && !ESTADOS.includes(body.estado)) {
      return json({ error: `estado debe ser uno de: ${ESTADOS.join(', ')}` }, 400);
    }
    const sb = getSupabaseServer();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const c of CAMPOS) if (c in body) patch[c] = body[c];
    const { data, error } = await sb.from('os_aprobaciones').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ aprobacion: data });
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
    const { error } = await sb.from('os_aprobaciones').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
