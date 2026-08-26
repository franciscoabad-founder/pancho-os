// Logica pura de la tabla `pendientes`: intenciones sin fecha comprometida.
//
// Extraida de src/pages/api/pendientes.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.
//
// El registro de evento del juego (registrarEvento) se mantiene aca porque es
// parte de la regla de negocio: cerrar un pendiente da XP. Sigue siendo
// fire-and-forget con .catch(() => null), igual que en Astro: si el motor falla,
// el pendiente ya quedo actualizado.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { registrarEvento } from '../lib/juego/motor.ts';

// Seam para tests: en produccion siempre resuelve a getSupabaseServer.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabasePendientes(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const ESTADOS = ['abierto', 'convertido', 'descartado', 'hecho'];
export const PRIORIDADES = ['low', 'medium', 'high', 'critical'];
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ErrorPendientes extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
    this.name = 'ErrorPendientes';
  }
}

export interface PendienteInput {
  id?: unknown;
  titulo?: unknown;
  detalle?: unknown;
  proyecto?: unknown;
  estado?: unknown;
  origen_nota_id?: unknown;
  convertido_a?: unknown;
  convertido_id?: unknown;
  deadline?: unknown;
  prioridad?: unknown;
}

function fechaValida(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !FECHA_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function normalizarDeadline(value: unknown): string | null {
  if (!fechaValida(value)) throw new ErrorPendientes('deadline debe tener formato YYYY-MM-DD', 400);
  return typeof value === 'string' && value ? value : null;
}

export function normalizarPrioridad(value: unknown): string {
  const prioridad = value === undefined || value === null || value === '' ? 'medium' : String(value);
  if (!PRIORIDADES.includes(prioridad)) throw new ErrorPendientes('prioridad invalida', 400);
  return prioridad;
}

export async function listarPendientes(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from('pendientes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearPendiente(body: PendienteInput): Promise<unknown> {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) throw new ErrorPendientes('titulo requerido', 400);
  const sb = clienteActual();
  const { data, error } = await sb
    .from('pendientes')
    .insert([{
      titulo,
      detalle: (body.detalle as string | undefined)?.trim() || null,
      proyecto: (body.proyecto as string | undefined)?.trim() || null,
      estado: ESTADOS.includes(body.estado as string) ? body.estado : 'abierto',
      origen_nota_id: body.origen_nota_id || null,
      deadline: normalizarDeadline(body.deadline),
      prioridad: normalizarPrioridad(body.prioridad),
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPendiente(id: string | null, body: PendienteInput): Promise<unknown> {
  if (!id) throw new ErrorPendientes('id requerido', 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.titulo === 'string') {
    const titulo = body.titulo.trim();
    if (!titulo) throw new ErrorPendientes('titulo requerido', 400);
    patch.titulo = titulo;
  }
  if ('detalle' in body) patch.detalle = body.detalle?.toString().trim() || null;
  if ('proyecto' in body) patch.proyecto = body.proyecto?.toString().trim() || null;
  if ('estado' in body) {
    const estado = body.estado?.toString();
    if (!ESTADOS.includes(estado ?? '')) throw new ErrorPendientes('estado invalido', 400);
    patch.estado = estado;
  }
  if ('convertido_a' in body) patch.convertido_a = body.convertido_a || null;
  if ('convertido_id' in body) patch.convertido_id = body.convertido_id || null;
  if ('deadline' in body) patch.deadline = normalizarDeadline(body.deadline);
  if ('prioridad' in body) patch.prioridad = normalizarPrioridad(body.prioridad);
  if (!Object.keys(patch).length) throw new ErrorPendientes('sin campos para actualizar', 400);
  patch.updated_at = new Date().toISOString();

  const sb = clienteActual();
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
  return data;
}

export async function eliminarPendiente(id: string | null): Promise<void> {
  if (!id) throw new ErrorPendientes('id requerido', 400);
  const sb = clienteActual();
  const { error } = await sb.from('pendientes').delete().eq('id', id);
  if (error) throw error;
}
