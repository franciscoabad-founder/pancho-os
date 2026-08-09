export const prerender = false;

// Backend de os_bandeja: bandeja de entrada de items capturados (enlaces, notas rapidas)
// pendientes de revisar y clasificar.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

const CAMPOS = ['titulo', 'url', 'descripcion', 'categoria', 'leido'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    let query = sb.from('os_bandeja').select('*').order('fecha_captura', { ascending: false });
    const leido = context.url.searchParams.get('leido');
    if (leido === '0') query = query.eq('leido', false);
    if (leido === '1') query = query.eq('leido', true);
    const { data, error } = await query;
    if (error) throw error;
    return json({ bandeja: data ?? [] });
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
      .from('os_bandeja')
      .insert([{
        titulo,
        url: body.url ?? null,
        descripcion: body.descripcion ?? null,
        categoria: body.categoria ?? null,
        leido: body.leido === true,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ item: data }, 201);
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
    const sb = getSupabaseServer();
    const patch: Record<string, unknown> = {};
    for (const c of CAMPOS) if (c in body) patch[c] = body[c];
    const { data, error } = await sb.from('os_bandeja').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ item: data });
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
    const { error } = await sb.from('os_bandeja').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
