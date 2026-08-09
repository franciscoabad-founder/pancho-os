export const prerender = false;

// Backend de os_lineas: las líneas de negocio/proyecto del OS (reemplaza el demo
// estático en apps/web/src/os/data/proyectos.ts). `prioridad_stack` codifica la
// metodología de priority stack (0=Urgente 1=Dinero 2=Soporte 3=Estabilizar 4=Pausado)
// y se usa como orden primario en el GET.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

const ESTADOS = ['activo', 'mantenimiento', 'pausado'];

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const soloMaker = context.url.searchParams.get('maker') === '1';
    let query = sb
      .from('os_lineas')
      .select('*')
      .order('prioridad_stack', { ascending: true })
      .order('orden', { ascending: true });
    if (soloMaker) query = query.eq('recibe_maker', true);
    const { data, error } = await query;
    if (error) throw error;
    return json({ lineas: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    if (!nombre) return json({ error: 'nombre requerido' }, 400);

    const prioridad = body.prioridad_stack === undefined ? 3 : Number(body.prioridad_stack);
    if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 4) {
      return json({ error: 'prioridad_stack debe estar entre 0 y 4' }, 400);
    }
    const estado = body.estado ? body.estado : 'activo';
    if (!ESTADOS.includes(estado)) return json({ error: 'estado invalido' }, 400);

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_lineas')
      .insert([{
        nombre,
        descripcion: body.descripcion ?? null,
        prioridad_stack: prioridad,
        recibe_maker: body.recibe_maker === true,
        objetivo_id: body.objetivo_id || null,
        siguiente_accion: body.siguiente_accion ?? null,
        estado,
        orden: Number.isFinite(Number(body.orden)) ? Number(body.orden) : null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, linea: data }, 201);
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe una linea con ese nombre' }, 400);
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
      'nombre', 'descripcion', 'prioridad_stack', 'recibe_maker', 'objetivo_id',
      'siguiente_accion', 'estado', 'orden', 'brain_tag',
    ];
    for (const c of campos) if (c in body) patch[c] = body[c];

    if ('nombre' in patch && !(patch.nombre as string)?.toString().trim()) {
      return json({ error: 'nombre requerido' }, 400);
    }
    if ('prioridad_stack' in patch) {
      const prioridad = Number(patch.prioridad_stack);
      if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 4) {
        return json({ error: 'prioridad_stack debe estar entre 0 y 4' }, 400);
      }
      patch.prioridad_stack = prioridad;
    }
    if ('estado' in patch && !ESTADOS.includes(patch.estado as string)) {
      return json({ error: 'estado invalido' }, 400);
    }

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_lineas')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, linea: data });
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe una linea con ese nombre' }, 400);
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
    const { error } = await sb.from('os_lineas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
