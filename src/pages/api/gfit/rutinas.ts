export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg } from '../../../lib/salud/apiHelpers';

const OBJETIVOS = ['fuerza', 'hipertrofia', 'resistencia'];
const ESTADOS = ['activa', 'archivada'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();
    const id = url.searchParams.get('id');
    const selDetalle =
      '*, dias:gfit_dias(*, gfit_dia_ejercicios(*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,imagenes,equipo,patron,musculos_primarios), gfit_series_plan(*)))';
    if (id) {
      const { data, error } = await sb.from('gfit_rutinas').select(selDetalle).eq('id', id).single();
      if (error) throw error;
      return json({ rutina: data });
    }

    let q = sb
      .from('gfit_rutinas')
      .select('*, dias:gfit_dias(count)')
      .order('created_at', { ascending: false });

    const estado = url.searchParams.get('estado');
    const all = url.searchParams.get('all');
    if (!all) {
      if (estado && ESTADOS.includes(estado)) q = q.eq('estado', estado);
      else q = q.eq('estado', 'activa');
    }

    const { data, error } = await q;
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
    if (body.objetivo && !OBJETIVOS.includes(body.objetivo)) {
      return json({ error: 'objetivo inválido' }, 400);
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('gfit_rutinas')
      .insert([{
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        objetivo: OBJETIVOS.includes(body.objetivo) ? body.objetivo : null,
        estado: 'activa',
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, rutina: data }, 201);
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
    if ('nombre' in body) {
      const nombre = body.nombre?.toString().trim();
      if (!nombre) return json({ error: 'nombre requerido' }, 400);
      patch.nombre = nombre;
    }
    if ('descripcion' in body) patch.descripcion = body.descripcion?.toString().trim() || null;
    if ('objetivo' in body) {
      if (body.objetivo && !OBJETIVOS.includes(body.objetivo)) return json({ error: 'objetivo inválido' }, 400);
      patch.objetivo = body.objetivo || null;
    }
    if ('estado' in body) {
      if (!ESTADOS.includes(body.estado)) return json({ error: 'estado inválido' }, 400);
      patch.estado = body.estado;
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb.from('gfit_rutinas').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ ok: true, rutina: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// Soft delete: no borra la rutina, la marca como archivada (conserva historial de sesiones).
export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('gfit_rutinas')
      .update({ estado: 'archivada', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, rutina: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
