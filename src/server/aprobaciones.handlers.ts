// Logica pura de os_aprobaciones: gate de decisiones sensibles.
//
// Extraida de src/pages/api/aprobaciones.ts (Astro) para reusarse desde la
// server route de TanStack Start. No depende de Astro ni del framework.
//
// Ojo al tocar esto: ademas de la pagina /aprobaciones, lo consumen las tools
// MCP aprobaciones_listar y aprobaciones_solicitar (src/mcp/osTools.ts) por HTTP
// contra /api/aprobaciones. Cambiar claves o codigos rompe a Hermes.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

// Seam para tests: en produccion siempre resuelve a getSupabaseServer.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseAprobaciones(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const CAMPOS = ['titulo', 'contexto', 'opciones', 'recomendacion', 'estado'];

export class ErrorAprobaciones extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
    this.name = 'ErrorAprobaciones';
  }
}

export interface AprobacionInput {
  titulo?: unknown;
  contexto?: unknown;
  opciones?: unknown;
  recomendacion?: unknown;
  estado?: unknown;
}

/** `estado` filtra por columna cuando viene en la query; null trae todo. */
export async function listarAprobaciones(estado: string | null): Promise<unknown[]> {
  const sb = clienteActual();
  let query = sb.from('os_aprobaciones').select('*').order('created_at', { ascending: false });
  if (estado) query = query.eq('estado', estado);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function crearAprobacion(body: AprobacionInput): Promise<unknown> {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) throw new ErrorAprobaciones('titulo requerido', 400);
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_aprobaciones')
    .insert([{
      titulo,
      contexto: body.contexto ?? null,
      opciones: Array.isArray(body.opciones) ? body.opciones : [],
      recomendacion: body.recomendacion ?? null,
      estado: ESTADOS.includes(body.estado as string) ? body.estado : 'pendiente',
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarAprobacion(id: string, body: Record<string, unknown>): Promise<unknown> {
  if ('estado' in body && !ESTADOS.includes(body.estado as string)) {
    throw new ErrorAprobaciones(`estado debe ser uno de: ${ESTADOS.join(', ')}`, 400);
  }
  const sb = clienteActual();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of CAMPOS) if (c in body) patch[c] = body[c];
  const { data, error } = await sb.from('os_aprobaciones').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarAprobacion(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('os_aprobaciones').delete().eq('id', id);
  if (error) throw error;
}
