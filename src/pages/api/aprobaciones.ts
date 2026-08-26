export const prerender = false;

// Backend de os_aprobaciones: gate de decisiones sensibles. Reemplaza el demo estatico
// `aprobacionesDefault` en os/data/sistema.ts, ahora persistido en Supabase.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const CAMPOS = ['titulo', 'contexto', 'opciones', 'recomendacion', 'estado', 'expira_at'];
const ACTORES = new Set(['web', 'hermes', 'api']);
const actor = (value: unknown) => typeof value === 'string' && ACTORES.has(value.trim().toLowerCase()) ? value.trim().toLowerCase() : 'web';

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
        estado: 'pendiente',
        decidido_at: null,
        decidido_por: null,
        expira_at: body.expira_at ?? null,
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
    const { data: actual, error: lecturaError } = await sb.from('os_aprobaciones').select('estado, expira_at').eq('id', id).maybeSingle();
    if (lecturaError) throw lecturaError;
    if (!actual) return json({ error: 'aprobacion no encontrada' }, 404);
    if (body.estado && body.estado !== 'pendiente' && actual.estado === 'pendiente' && actual.expira_at && new Date(actual.expira_at).getTime() <= Date.now()) {
      return json({ error: 'la aprobacion ya expiro' }, 409);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('estado' in body && body.estado !== 'pendiente') {
      patch.decidido_at = new Date().toISOString();
      patch.decidido_por = actor(body.decidido_por);
    } else if (body.estado === 'pendiente') {
      patch.decidido_at = null;
      patch.decidido_por = null;
    }
    for (const c of CAMPOS) if (c in body) patch[c] = body[c];
    let updateQuery = sb.from('os_aprobaciones').update(patch).eq('id', id);
    if (body.estado && body.estado !== 'pendiente') updateQuery = updateQuery.eq('estado', 'pendiente');
    const { data, error } = await updateQuery.select().maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: 'la aprobacion ya fue decidida o no existe' }, 409);
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
