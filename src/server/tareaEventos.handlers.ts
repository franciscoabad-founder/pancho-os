// Feed unificado de una tarea: comentarios (humano o Hermes), cambios de
// campo y eventos de sistema, todos en `tarea_eventos`. Ver la migracion
// 20260831000200_tarea_eventos.sql para el porque de una sola tabla.
//
// El `autor` de un evento NUNCA sale del body: siempre lo decide el llamador
// (src/routes/api/tareas/*.ts) a partir de identidadCliente(request)
// (src/server/osAuth.ts), mismo principio que journal_log fijando
// fuente:'hermes'. Este modulo solo recibe el Actor ya resuelto.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

export interface Actor {
  actor: string;
  tipo: 'humano' | 'agente';
}

export interface TareaEvento {
  id: string;
  tarea_id: string;
  tipo: 'comentario' | 'cambio' | 'sistema';
  autor: string | null;
  autor_tipo: string | null;
  origen: string | null;
  cuerpo: string | null;
  cambios: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  editado_at: string | null;
}

export class ErrorTareaEventos extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ErrorTareaEventos';
    this.status = status;
  }
}

/** `limit(200)` desc, opcionalmente filtrado por tipo. Un hilo personal no
 * necesita paginacion keyset: son decenas de eventos, no miles. */
export async function listarEventos(
  sb: SupabaseClient,
  tareaId: string,
  tipo?: string | null,
): Promise<TareaEvento[]> {
  let query = sb
    .from('tarea_eventos')
    .select('*')
    .eq('tarea_id', tareaId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (tipo) query = query.eq('tipo', tipo);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TareaEvento[];
}

/** Un evento tipo 'cambio' por PATCH, con todos los campos modificados en un
 * solo jsonb. No falla el PATCH que lo origina: el llamador decide si lo
 * espera o lo dispara en background. */
export async function registrarCambio(
  sb: SupabaseClient,
  tareaId: string,
  cambios: Record<string, unknown>,
  actor: Actor,
  origen = 'os',
): Promise<void> {
  if (!Object.keys(cambios).length) return;
  const { error } = await sb.from('tarea_eventos').insert([{
    tarea_id: tareaId,
    tipo: 'cambio',
    autor: actor.actor,
    autor_tipo: actor.tipo,
    origen,
    cambios,
  }]);
  if (error) throw error;
}

export async function crearComentario(
  tareaId: string,
  cuerpo: string,
  actor: Actor,
  origen = 'os',
  sb: SupabaseClient = getSupabaseServer(),
): Promise<TareaEvento> {
  const texto = typeof cuerpo === 'string' ? cuerpo.trim() : '';
  if (!texto) throw new ErrorTareaEventos('cuerpo requerido', 400);

  const { data: tarea, error: tareaError } = await sb
    .from('tareas')
    .select('id')
    .eq('id', tareaId)
    .maybeSingle();
  if (tareaError) throw tareaError;
  if (!tarea) throw new ErrorTareaEventos('tarea no encontrada', 404);

  const { data, error } = await sb
    .from('tarea_eventos')
    .insert([{ tarea_id: tareaId, tipo: 'comentario', autor: actor.actor, autor_tipo: actor.tipo, origen, cuerpo: texto }])
    .select()
    .single();
  if (error) throw error;
  return data as TareaEvento;
}

// Solo se edita/borra tipo='comentario', y solo el propio autor: 'cambio' y
// 'sistema' son inmutables (los escribio el propio backend, no un humano).
async function comentarioEditable(sb: SupabaseClient, id: string, actor: Actor) {
  const { data: actual, error } = await sb
    .from('tarea_eventos')
    .select('id, tipo, autor')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!actual) throw new ErrorTareaEventos('comentario no encontrado', 404);
  if (actual.tipo !== 'comentario') throw new ErrorTareaEventos('solo se editan o eliminan comentarios', 400);
  if (actual.autor !== actor.actor) throw new ErrorTareaEventos('solo el autor puede editar o eliminar su comentario', 403);
  return actual;
}

export async function actualizarComentario(
  id: string,
  cuerpo: string,
  actor: Actor,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<TareaEvento> {
  const texto = typeof cuerpo === 'string' ? cuerpo.trim() : '';
  if (!texto) throw new ErrorTareaEventos('cuerpo requerido', 400);
  await comentarioEditable(sb, id, actor);
  const { data, error } = await sb
    .from('tarea_eventos')
    .update({ cuerpo: texto, editado_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TareaEvento;
}

export async function eliminarComentario(
  id: string,
  actor: Actor,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<void> {
  await comentarioEditable(sb, id, actor);
  const { error } = await sb.from('tarea_eventos').delete().eq('id', id);
  if (error) throw error;
}
