export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

const ESTADOS = ['pendiente', 'enviado', 'hecho', 'cancelado'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('recordatorios')
      .select('*')
      .order('recordar_at', { ascending: true });
    if (error) throw error;
    return json({ recordatorios: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.mensaje?.trim()) return json({ error: 'mensaje requerido' }, 400);
    if (!body.recordar_at) return json({ error: 'recordar_at requerido' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('recordatorios')
      .insert([{
        mensaje: body.mensaje.trim(),
        recordar_at: body.recordar_at,
        canal: body.canal?.trim() || 'telegram',
        tarea_id: body.tarea_id || null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, recordatorio: data }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { request, url } = context;
  try {
    const body = await request.json();
    const id = url.searchParams.get('id') ?? body.id;
    if (!id) return json({ error: 'id requerido' }, 400);

    const patch: Record<string, unknown> = {};
    if (typeof body.mensaje === 'string') {
      const mensaje = body.mensaje.trim();
      if (!mensaje) return json({ error: 'mensaje requerido' }, 400);
      patch.mensaje = mensaje;
    }
    if ('recordar_at' in body) {
      if (!body.recordar_at) return json({ error: 'recordar_at requerido' }, 400);
      patch.recordar_at = body.recordar_at;
    }
    if ('canal' in body) patch.canal = body.canal?.toString().trim() || 'telegram';
    if ('tarea_id' in body) patch.tarea_id = body.tarea_id || null;
    if ('estado' in body) {
      const estado = body.estado?.toString();
      if (!ESTADOS.includes(estado)) return json({ error: 'estado invalido' }, 400);
      patch.estado = estado;
      if (estado === 'enviado') patch.enviado_at = new Date().toISOString();
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
    patch.updated_at = new Date().toISOString();

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('recordatorios')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, recordatorio: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('recordatorios').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
