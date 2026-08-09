export const prerender = false;

// Backend de os_objetivos: los 1-3 objetivos activos del OS (reemplaza el demo estático
// en apps/web/src/os/data/objetivos.ts). Cada objetivo activo ocupa una posición única
// (`orden`, 1..3, único mientras `activo=true` via índice parcial en DB); esa regla de
// metodología (máximo 3 objetivos activos) se hace cumplir dejando que la constraint de
// Postgres rechace el insert/update y mapeando el 23505 resultante a 400.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const todos = context.url.searchParams.get('todos') === '1';
    let query = sb.from('os_objetivos').select('*').order('orden', { ascending: true });
    if (!todos) query = query.eq('activo', true);
    const { data, error } = await query;
    if (error) throw error;
    return json({ objetivos: data ?? [] });
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

    const orden = Number(body.orden);
    if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
      return json({ error: 'orden debe ser 1, 2 o 3' }, 400);
    }

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_objetivos')
      .insert([{
        orden,
        titulo,
        descripcion: body.descripcion ?? null,
        metrica_resultado: body.metrica_resultado ?? null,
        punto_partida: body.punto_partida ?? null,
        medida_avance: body.medida_avance ?? null,
        fecha_inicio: body.fecha_inicio || null,
        fecha_fin: body.fecha_fin || null,
        activo: body.activo === false ? false : true,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, objetivo: data }, 201);
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe un objetivo activo en esa posicion' }, 400);
    }
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
    const campos = [
      'orden', 'titulo', 'descripcion', 'metrica_resultado', 'punto_partida',
      'medida_avance', 'fecha_inicio', 'fecha_fin', 'activo',
    ];
    for (const c of campos) if (c in body) patch[c] = body[c];
    if ('titulo' in patch && !(patch.titulo as string)?.toString().trim()) {
      return json({ error: 'titulo requerido' }, 400);
    }
    if ('orden' in patch) {
      const orden = Number(patch.orden);
      if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
        return json({ error: 'orden debe ser 1, 2 o 3' }, 400);
      }
      patch.orden = orden;
    }

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_objetivos')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, objetivo: data });
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe un objetivo activo en esa posicion' }, 400);
    }
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('os_objetivos').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
