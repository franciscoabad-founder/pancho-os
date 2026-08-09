export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

const ESTADOS = ['activa', 'convertida', 'archivada'];
const DESTINOS = ['pendiente', 'tarea', 'recordatorio'] as const;
type Destino = (typeof DESTINOS)[number];

async function convertirNota(convertir: { id?: string; a?: string; payload?: Record<string, any> }) {
  const { id, a, payload = {} } = convertir;
  if (!id) return json({ error: 'convertir.id requerido' }, 400);
  if (!DESTINOS.includes(a as Destino)) {
    return json({ error: "convertir.a debe ser 'pendiente', 'tarea' o 'recordatorio'" }, 400);
  }
  const destino = a as Destino;
  const sb = getSupabaseServer();

  const { data: nota, error: notaError } = await sb
    .from('notas')
    .select('*')
    .eq('id', id)
    .single();
  if (notaError) throw notaError;
  if (!nota) return json({ error: 'nota no encontrada' }, 404);
  if (nota.estado === 'convertida') return json({ error: 'la nota ya fue convertida' }, 400);

  let creado: any = null;

  if (destino === 'pendiente') {
    const { data, error } = await sb
      .from('pendientes')
      .insert([{
        titulo: payload.titulo?.trim() || nota.contenido.slice(0, 200),
        detalle: payload.detalle?.trim() || (payload.titulo ? nota.contenido : null),
        proyecto: payload.proyecto?.trim() || null,
        origen_nota_id: nota.id,
      }])
      .select()
      .single();
    if (error) throw error;
    creado = data;
  } else if (destino === 'tarea') {
    const { data, error } = await sb
      .from('tareas')
      .insert([{
        titulo: payload.titulo?.trim() || nota.contenido.slice(0, 200),
        proyecto: payload.proyecto?.trim() || null,
        estado: 'pendiente',
        deadline: payload.deadline || null,
        prioridad: ['low', 'medium', 'high', 'critical'].includes(payload.prioridad) ? payload.prioridad : 'medium',
        grupo: payload.grupo?.trim() || 'general',
        tipo: payload.tipo?.trim() || null,
        notas: payload.notas ?? nota.contenido,
      }])
      .select()
      .single();
    if (error) throw error;
    creado = data;
  } else {
    if (!payload.recordar_at) return json({ error: 'payload.recordar_at requerido para recordatorio' }, 400);
    const { data, error } = await sb
      .from('recordatorios')
      .insert([{
        mensaje: payload.mensaje?.trim() || nota.contenido.slice(0, 300),
        recordar_at: payload.recordar_at,
        canal: payload.canal?.trim() || 'telegram',
      }])
      .select()
      .single();
    if (error) throw error;
    creado = data;
  }

  const { data: notaActualizada, error: updateError } = await sb
    .from('notas')
    .update({
      estado: 'convertida',
      convertida_a: destino,
      convertida_id: creado.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', nota.id)
    .select()
    .single();
  if (updateError) throw updateError;

  return json({ ok: true, nota: notaActualizada, creado, destino }, 201);
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('notas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ notas: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();

    if (body.convertir) {
      return await convertirNota(body.convertir);
    }

    if (!body.contenido?.trim()) return json({ error: 'contenido requerido' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('notas')
      .insert([{
        contenido: body.contenido.trim(),
        tags: Array.isArray(body.tags) ? body.tags : [],
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, nota: data }, 201);
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
    if (typeof body.contenido === 'string') {
      const contenido = body.contenido.trim();
      if (!contenido) return json({ error: 'contenido requerido' }, 400);
      patch.contenido = contenido;
    }
    if ('tags' in body) patch.tags = Array.isArray(body.tags) ? body.tags : [];
    if ('estado' in body) {
      const estado = body.estado?.toString();
      if (!ESTADOS.includes(estado)) return json({ error: 'estado invalido' }, 400);
      patch.estado = estado;
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
    patch.updated_at = new Date().toISOString();

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('notas')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, nota: data });
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
    const { error } = await sb.from('notas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
