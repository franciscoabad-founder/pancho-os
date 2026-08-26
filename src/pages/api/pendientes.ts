export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { registrarEvento } from '../../lib/juego/motor';

const ESTADOS = ['abierto', 'convertido', 'descartado', 'hecho'];
const PRIORIDADES = ['low', 'medium', 'high', 'critical'];
const fechaValida = (value: unknown) => value == null || value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()));

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('pendientes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ pendientes: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.titulo?.trim()) return json({ error: 'titulo requerido' }, 400);
    if (!fechaValida(body.deadline)) return json({ error: 'deadline debe tener formato YYYY-MM-DD' }, 400);
    if (body.prioridad != null && !PRIORIDADES.includes(body.prioridad)) return json({ error: 'prioridad invalida' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('pendientes')
      .insert([{
        titulo: body.titulo.trim(),
        detalle: body.detalle?.trim() || null,
        proyecto: body.proyecto?.trim() || null,
        estado: ESTADOS.includes(body.estado) ? body.estado : 'abierto',
        origen_nota_id: body.origen_nota_id || null,
        deadline: body.deadline || null,
        prioridad: body.prioridad || 'medium',
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, pendiente: data }, 201);
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
    if (typeof body.titulo === 'string') {
      const titulo = body.titulo.trim();
      if (!titulo) return json({ error: 'titulo requerido' }, 400);
      patch.titulo = titulo;
    }
    if ('detalle' in body) patch.detalle = body.detalle?.toString().trim() || null;
    if ('proyecto' in body) patch.proyecto = body.proyecto?.toString().trim() || null;
    if ('estado' in body) {
      const estado = body.estado?.toString();
      if (!ESTADOS.includes(estado)) return json({ error: 'estado invalido' }, 400);
      patch.estado = estado;
    }
    if ('convertido_a' in body) patch.convertido_a = body.convertido_a || null;
    if ('convertido_id' in body) patch.convertido_id = body.convertido_id || null;
    if ('deadline' in body) {
      if (!fechaValida(body.deadline)) return json({ error: 'deadline debe tener formato YYYY-MM-DD' }, 400);
      patch.deadline = body.deadline || null;
    }
    if ('prioridad' in body) {
      if (!PRIORIDADES.includes(body.prioridad)) return json({ error: 'prioridad invalida' }, 400);
      patch.prioridad = body.prioridad;
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
    patch.updated_at = new Date().toISOString();

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('pendientes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (patch.estado === 'hecho') {
      registrarEvento(sb, { tipo: 'pendiente_hecho', ref_tabla: 'pendientes', ref_id: id }).catch(() => null);
    }
    return json({ ok: true, pendiente: data });
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
    const { error } = await sb.from('pendientes').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
