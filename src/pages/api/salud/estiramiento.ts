export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg } from '../../../lib/salud/apiHelpers';

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('rutinas_estiramiento')
      .select('*')
      .eq('archivada', false)
      .order('created_at', { ascending: true });
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
      .from('rutinas_estiramiento')
      .insert([{
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        pasos: Array.isArray(body.pasos) ? body.pasos : [],
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ rutina: data }, 201);
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
    for (const c of ['nombre', 'descripcion']) if (c in body) patch[c] = body[c]?.trim?.() || null;
    if ('pasos' in body) patch.pasos = Array.isArray(body.pasos) ? body.pasos : [];
    if ('archivada' in body) patch.archivada = !!body.archivada;
    const sb = getSupabaseServer();
    const { data, error } = await sb.from('rutinas_estiramiento').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ rutina: data });
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
    const { error } = await sb.from('rutinas_estiramiento').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
