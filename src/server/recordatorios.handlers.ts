// Logica pura de la tabla `recordatorios`: avisos con fecha que Hermes empuja al
// celular.
//
// Extraida de src/pages/api/recordatorios.ts (Astro) para reusarse desde la
// server route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

// Seam para tests: en produccion siempre resuelve a getSupabaseServer.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseRecordatorios(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const ESTADOS = ['pendiente', 'enviado', 'hecho', 'cancelado', 'archivado'];

export class ErrorRecordatorios extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
    this.name = 'ErrorRecordatorios';
  }
}

export interface RecordatorioInput {
  id?: unknown;
  mensaje?: unknown;
  recordar_at?: unknown;
  canal?: unknown;
  tarea_id?: unknown;
  estado?: unknown;
}

export async function listarRecordatorios(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from('recordatorios')
    .select('*')
    .order('recordar_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function crearRecordatorio(body: RecordatorioInput): Promise<unknown> {
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!mensaje) throw new ErrorRecordatorios('mensaje requerido', 400);
  if (!body.recordar_at) throw new ErrorRecordatorios('recordar_at requerido', 400);
  const sb = clienteActual();
  const { data, error } = await sb
    .from('recordatorios')
    .insert([{
      mensaje,
      recordar_at: body.recordar_at,
      canal: (body.canal as string | undefined)?.trim() || 'telegram',
      tarea_id: body.tarea_id || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarRecordatorio(id: string | null, body: RecordatorioInput): Promise<unknown> {
  if (!id) throw new ErrorRecordatorios('id requerido', 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.mensaje === 'string') {
    const mensaje = body.mensaje.trim();
    if (!mensaje) throw new ErrorRecordatorios('mensaje requerido', 400);
    patch.mensaje = mensaje;
  }
  if ('recordar_at' in body) {
    if (!body.recordar_at) throw new ErrorRecordatorios('recordar_at requerido', 400);
    patch.recordar_at = body.recordar_at;
  }
  if ('canal' in body) patch.canal = body.canal?.toString().trim() || 'telegram';
  if ('tarea_id' in body) patch.tarea_id = body.tarea_id || null;
  if ('estado' in body) {
    const estado = body.estado?.toString();
    if (!ESTADOS.includes(estado ?? '')) throw new ErrorRecordatorios('estado invalido', 400);
    patch.estado = estado;
    if (estado === 'enviado') patch.enviado_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) throw new ErrorRecordatorios('sin campos para actualizar', 400);
  patch.updated_at = new Date().toISOString();

  const sb = clienteActual();
  const { data, error } = await sb
    .from('recordatorios')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarRecordatorio(id: string | null): Promise<void> {
  if (!id) throw new ErrorRecordatorios('id requerido', 400);
  const sb = clienteActual();
  const { error } = await sb.from('recordatorios').delete().eq('id', id);
  if (error) throw error;
}
