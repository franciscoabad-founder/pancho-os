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

export const ESTADOS = ['pendiente', 'aprobado', 'rechazado', 'archivada'];
const CAMPOS = ['titulo', 'contexto', 'opciones', 'recomendacion', 'estado', 'expira_at'];

// Una aprobacion pendiente que Pancho no toco en DIAS_ARCHIVO dias (o que ya
// paso su expira_at) deja de ser accionable: se archiva sola. Asi el panel no
// se llena de decisiones muertas de hace semanas. El archivado es en lote y NO
// dispara el webhook (no es una decision, es limpieza).
const DIAS_ARCHIVO = 7;

async function archivarPendientesViejas(sb: SupabaseClient): Promise<void> {
  const ahora = new Date();
  const corte = new Date(ahora.getTime() - DIAS_ARCHIVO * 24 * 60 * 60 * 1000).toISOString();
  await sb
    .from('os_aprobaciones')
    .update({ estado: 'archivada', updated_at: ahora.toISOString() })
    .eq('estado', 'pendiente')
    .or(`expira_at.lt.${ahora.toISOString()},created_at.lt.${corte}`);
}
const ACTORES = new Set(['web', 'hermes', 'api']);

function normalizarActor(value: unknown): string {
  const actor = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ACTORES.has(actor) ? actor : 'web';
}

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
  expira_at?: unknown;
}

/** `estado` filtra por columna cuando viene en la query; null trae todo. */
export async function listarAprobaciones(estado: string | null): Promise<unknown[]> {
  if (estado && !ESTADOS.includes(estado)) {
    throw new ErrorAprobaciones(`estado debe ser uno de: ${ESTADOS.join(', ')}`, 400);
  }
  const sb = clienteActual();
  // Antes de listar, archiva las pendientes vencidas (limpieza perezosa).
  await archivarPendientesViejas(sb);
  let query = sb.from('os_aprobaciones').select('*').order('created_at', { ascending: false });
  if (estado) {
    query = query.eq('estado', estado);
  } else {
    // Sin filtro explicito, el panel muestra solo lo vivo (no archivadas).
    query = query.neq('estado', 'archivada');
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function crearAprobacion(body: AprobacionInput): Promise<unknown> {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) throw new ErrorAprobaciones('titulo requerido', 400);
  const expiraAt = body.expira_at == null || body.expira_at === '' ? null : String(body.expira_at);
  if (expiraAt && Number.isNaN(Date.parse(expiraAt))) {
    throw new ErrorAprobaciones('expira_at invalido', 400);
  }
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_aprobaciones')
    .insert([{
      titulo,
      contexto: body.contexto ?? null,
      opciones: Array.isArray(body.opciones) ? body.opciones : [],
      recomendacion: body.recomendacion ?? null,
      estado: 'pendiente',
      decidido_at: null,
      decidido_por: null,
      expira_at: expiraAt,
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
  const { data: actual, error: lecturaError } = await sb.from('os_aprobaciones').select('estado, expira_at').eq('id', id).maybeSingle();
  if (lecturaError) throw lecturaError;
  if (!actual) throw new ErrorAprobaciones('aprobacion no encontrada', 404);
  if (body.estado && body.estado !== 'pendiente' && actual.estado === 'pendiente' && actual.expira_at && new Date(actual.expira_at).getTime() <= Date.now()) {
    throw new ErrorAprobaciones('la aprobacion ya expiro', 409);
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('expira_at' in body && body.expira_at != null && body.expira_at !== '' && Number.isNaN(Date.parse(String(body.expira_at)))) {
    throw new ErrorAprobaciones('expira_at invalido', 400);
  }
  if ('estado' in body && body.estado !== 'pendiente') {
    patch.decidido_at = new Date().toISOString();
    patch.decidido_por = normalizarActor(body.decidido_por);
  } else if (body.estado === 'pendiente') {
    patch.decidido_at = null;
    patch.decidido_por = null;
  }
  for (const c of CAMPOS) if (c in body) patch[c] = body[c];
  let updateQuery = sb.from('os_aprobaciones').update(patch).eq('id', id);
  if (body.estado && body.estado !== 'pendiente') updateQuery = updateQuery.eq('estado', 'pendiente');
  const { data, error } = await updateQuery.select().maybeSingle();
  if (error) throw error;
  if (!data) throw new ErrorAprobaciones('la aprobacion ya fue decidida o no existe', 409);
  return data;
}

export async function eliminarAprobacion(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('os_aprobaciones').delete().eq('id', id);
  if (error) throw error;
}
