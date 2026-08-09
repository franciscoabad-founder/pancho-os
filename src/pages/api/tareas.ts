export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { registrarEvento } from '../../lib/juego/motor';

const PRIORIDADES = ['low', 'medium', 'high', 'critical'];

async function validarDeadlineConPadre(
  sb: ReturnType<typeof getSupabaseServer>,
  parentId: string,
  deadline: string | null,
): Promise<string | null> {
  const { data: padre, error } = await sb
    .from('tareas')
    .select('id, deadline')
    .eq('id', parentId)
    .maybeSingle();
  if (error) throw error;
  if (!padre) return 'parent_id no corresponde a una tarea existente';
  if (deadline && padre.deadline && deadline > padre.deadline) {
    return `el deadline de la subtarea (${deadline}) no puede ser posterior al de la tarea padre (${padre.deadline})`;
  }
  return null;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('tareas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ tareas: data ?? [] });
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
    const sb = getSupabaseServer();

    const deadline = body.deadline || null;
    const parentId = body.parent_id || null;
    if (parentId) {
      const invalido = await validarDeadlineConPadre(sb, parentId, deadline);
      if (invalido) return json({ error: invalido }, 400);
    }

    const { data, error } = await sb
      .from('tareas')
      .insert([{
        titulo: body.titulo.trim(),
        proyecto: body.proyecto?.trim() || null,
        categoria: body.categoria?.trim() || null,
        estado: body.estado ?? 'pendiente',
        urgente: body.urgente === true || body.urgente === 'true',
        deadline,
        notas: body.notas ?? null,
        prioridad: PRIORIDADES.includes(body.prioridad) ? body.prioridad : 'medium',
        tipo: body.tipo?.trim() || null,
        grupo: body.grupo?.trim() || 'general',
        parent_id: parentId,
        orden: Number.isFinite(Number(body.orden)) ? Number(body.orden) : 0,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, tarea: data }, 201);
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
    if ('proyecto' in body) patch.proyecto = body.proyecto?.toString().trim() || null;
    if ('urgente' in body) patch.urgente = body.urgente === true || body.urgente === 'true';
    if ('estado' in body) {
      const estado = body.estado?.toString();
      if (!['pendiente', 'en_progreso', 'hecho'].includes(estado)) {
        return json({ error: 'estado invalido' }, 400);
      }
      patch.estado = estado;
    }
    if ('deadline' in body) patch.deadline = body.deadline || null;
    if ('prioridad' in body) {
      if (!PRIORIDADES.includes(body.prioridad)) return json({ error: 'prioridad invalida' }, 400);
      patch.prioridad = body.prioridad;
    }
    if ('tipo' in body) patch.tipo = body.tipo?.toString().trim() || null;
    if ('grupo' in body) patch.grupo = body.grupo?.toString().trim() || 'general';
    if ('parent_id' in body) patch.parent_id = body.parent_id || null;
    if ('orden' in body) patch.orden = Number.isFinite(Number(body.orden)) ? Number(body.orden) : 0;
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);

    const sb = getSupabaseServer();

    if ('parent_id' in patch || 'deadline' in patch) {
      const { data: actual, error: actualError } = await sb
        .from('tareas')
        .select('id, deadline, parent_id')
        .eq('id', id)
        .maybeSingle();
      if (actualError) throw actualError;
      if (!actual) return json({ error: 'tarea no encontrada' }, 404);

      const parentId = ('parent_id' in patch ? patch.parent_id : actual.parent_id) as string | null;
      const deadline = ('deadline' in patch ? patch.deadline : actual.deadline) as string | null;
      if (parentId) {
        if (parentId === id) return json({ error: 'una tarea no puede ser su propio padre' }, 400);
        const invalido = await validarDeadlineConPadre(sb, parentId, deadline);
        if (invalido) return json({ error: invalido }, 400);
      }
    }

    const { data, error } = await sb
      .from('tareas')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (patch.estado === 'hecho') {
      registrarEvento(sb, { tipo: 'tarea_hecha', ref_tabla: 'tareas', ref_id: id, meta: { prioridad: data.prioridad } }).catch(() => null);
    }
    return json({ ok: true, tarea: data });
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
    const { error } = await sb.from('tareas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
